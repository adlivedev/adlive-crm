import "server-only";

/**
 * MOTOR REAL DE EJECUCIÓN DE WORKFLOWS (servidor).
 *
 * Ejecuta los workflows PUBLICADOS de un tenant cuando ocurre un evento real:
 *  - «contact_created»: un lead llegó desde una landing o formulario web.
 *  - «first_message»: llegó el PRIMER mensaje de WhatsApp de un contacto.
 *
 * Soporta los nodos de acción del constructor visual:
 *  - Enviar WhatsApp (plantilla aprobada de Meta con variables del contacto).
 *  - Marcar en seguimiento (⭐).
 *  - Mover a etapa / Crear oportunidad.
 *  - Asignar a un miembro (Round Robin equitativo entre agentes activos,
 *    ordenados por last_assigned_at ASC NULLS FIRST).
 *
 * Cada ejecución persiste workflow_enrollments con su execution_logs,
 * respeta allow_reenrollment (idempotencia) y respeta el opt-out de
 * marketing del contacto. Solo corre en servidor (server-only, Service
 * Role, credenciales Meta descifradas en la bóveda del tenant).
 */

import { sendMetaTemplate } from "@/shared/lib/metaWhatsAppClient";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { triggerFilterMatches } from "@/shared/lib/workflowEngine";
import { buildTemplateVariables } from "@/shared/lib/whatsapp";
import type {
  Contact,
  PipelineStage,
  Workflow,
  WorkflowExecutionLogEntry,
  WorkflowNode,
} from "@/shared/types/database";

type Admin = ReturnType<typeof createAdminClient>;

export type WorkflowContactEvent = "contact_created" | "first_message";

const EVENT_TRIGGER_TYPE: Record<WorkflowContactEvent, Workflow["trigger_type"]> = {
  contact_created: "contact_created",
  first_message: "channel_message_received",
};

interface NodeResult { outcome: WorkflowExecutionLogEntry["outcome"]; detail: string }

const MAX_STEPS = 25;

/* ----------------------------------------------------------------------------
 * Entrada pública
 * -------------------------------------------------------------------------- */

/**
 * Ejecuta todos los workflows publicados del tenant cuyo disparador coincide
 * con el evento. Devuelve cuántos flujos hicieron match y cuántos inscribieron.
 */
export async function executeWorkflowsForEvent(input: {
  tenantId: string;
  contactId: string;
  event: WorkflowContactEvent;
  utmCampaign?: string | null;
  landingUrl?: string | null;
  formName?: string | null;
}): Promise<{ matched: number; enrolled: number }> {
  const admin = createAdminClient();
  const { data: contactRow, error: contactError } = await admin.from("contacts").select("*")
    .eq("id", input.contactId).eq("tenant_id", input.tenantId).maybeSingle();
  if (contactError) throw new Error(`Supabase contacts: ${contactError.message}`);
  if (!contactRow) return { matched: 0, enrolled: 0 };
  const contact = contactRow as Contact;

  const { data: workflows } = await admin.from("workflows").select("*")
    .eq("tenant_id", input.tenantId).eq("status", "Published");
  const triggerType = EVENT_TRIGGER_TYPE[input.event];
  const candidates = ((workflows ?? []) as Workflow[]).filter((workflow) => workflow.trigger_type === triggerType);

  let matched = 0;
  let enrolled = 0;
  for (const workflow of candidates) {
    try {
      const triggerNode = workflow.canvas_definition.nodes.find((node) => node.type === "trigger")
        ?? workflow.canvas_definition.nodes[0] ?? null;
      if (!triggerNode) continue;
      const matchesFilter = triggerFilterMatches(triggerNode.config, {
        utmCampaign: input.utmCampaign ?? null,
        landingUrl: input.landingUrl ?? null,
        tags: contact.tags ?? [],
        formName: input.formName ?? null,
      });
      if (!matchesFilter) continue;
      matched += 1;

      const { data: existing } = await admin.from("workflow_enrollments").select("id")
        .eq("workflow_id", workflow.id).eq("contact_id", input.contactId).limit(1);
      if ((existing?.length ?? 0) > 0 && !workflow.allow_reenrollment) {
        console.info("workflow.enrollment.skipped", JSON.stringify({
          workflowId: workflow.id, contactId: input.contactId, reason: "already_enrolled",
        }));
        continue;
      }
      await executeWorkflowCanvas(admin, workflow, contact);
      enrolled += 1;
    } catch (error) {
      console.error("workflow.execution.failed", JSON.stringify({
        workflowId: workflow.id, contactId: input.contactId,
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown error",
      }));
    }
  }
  return { matched, enrolled };
}

/**
 * Dispara los workflows «Mensaje recibido en WhatsApp» cuando el mensaje
 * ingerido es el PRIMER mensaje entrante de su conversación.
 */
export async function executeWorkflowsForFirstInboundMessage(tenantId: string, waMessageId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: message } = await admin.from("messages").select("id,conversation_id,direction")
    .eq("tenant_id", tenantId).eq("wa_message_id", waMessageId).maybeSingle();
  if (!message || message.direction !== "inbound") return;
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("conversation_id", message.conversation_id).eq("direction", "inbound");
  if ((count ?? 0) > 1) return;
  const { data: conversation } = await admin.from("conversations").select("contact_id")
    .eq("id", message.conversation_id).maybeSingle();
  if (!conversation?.contact_id) return;
  await executeWorkflowsForEvent({ tenantId, contactId: conversation.contact_id, event: "first_message" });
}

/**
 * Barrido SLA (disparador «SLA: sin respuesta del agente»): evalúa cada tick
 * del cron todos los workflows publicados con trigger_type sla_no_response,
 * inscribiendo los contactos cuya conversación humana superó el tiempo SLA
 * configurado sin respuesta. No repite la inscripción dentro de la misma
 * ventana de espera (created_at >= last_inbound_at de la conversación).
 */
export async function runSlaWorkflowsSweep(
  activeTenantIds?: ReadonlySet<string>,
): Promise<{ workflows: number; enrolled: number }> {
  const admin = createAdminClient();
  const { data: workflows } = await admin.from("workflows").select("*")
    .eq("status", "Published").eq("trigger_type", "sla_no_response");
  const candidates = ((workflows ?? []) as Workflow[]).filter(
    (workflow) => !activeTenantIds || activeTenantIds.has(workflow.tenant_id),
  );
  let enrolled = 0;
  for (const workflow of candidates) {
    const triggerNode = workflow.canvas_definition.nodes.find((node) => node.type === "trigger");
    const minutes = Math.min(Math.max(Math.round(Number(triggerNode?.config.sla_minutes ?? "60")) || 60, 5), 1440);
    const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
    const { data: stale } = await admin.from("conversations").select("id, contact_id, last_inbound_at")
      .eq("tenant_id", workflow.tenant_id).eq("handler_mode", "human").eq("needs_reply", true)
      .lte("last_inbound_at", cutoff);
    for (const conversation of stale ?? []) {
      const { data: recent } = await admin.from("workflow_enrollments").select("id")
        .eq("workflow_id", workflow.id).eq("contact_id", conversation.contact_id)
        .gte("created_at", conversation.last_inbound_at).limit(1);
      if ((recent?.length ?? 0) > 0) continue;
      const { data: contactRow } = await admin.from("contacts").select("*")
        .eq("id", conversation.contact_id).eq("tenant_id", workflow.tenant_id).maybeSingle();
      if (!contactRow) continue;
      try {
        await executeWorkflowCanvas(admin, workflow, contactRow as Contact);
        enrolled += 1;
      } catch (error) {
        console.error("workflow.sla.failed", JSON.stringify({
          workflowId: workflow.id, contactId: conversation.contact_id,
          message: error instanceof Error ? error.message.slice(0, 300) : "unknown error",
        }));
      }
    }
  }
  return { workflows: candidates.length, enrolled };
}

/* ----------------------------------------------------------------------------
 * Ejecución del lienzo (recorrido lineal desde el disparador)
 * -------------------------------------------------------------------------- */

async function executeWorkflowCanvas(admin: Admin, workflow: Workflow, contact: Contact): Promise<void> {
  const now = new Date().toISOString();
  const logs: WorkflowExecutionLogEntry[] = [];
  let status: "completed" | "failed" | "active" = "completed";
  let waitExpiresAt: string | null = null;
  let currentNodeId: string | null = null;
  const pushLog = (nodeId: string, nodeLabel: string, outcome: WorkflowExecutionLogEntry["outcome"], detail: string) => {
    logs.push({ node_id: nodeId, node_label: nodeLabel, executed_at: new Date().toISOString(), outcome, detail });
  };

  const canvas = workflow.canvas_definition;
  const nodeById = (nodeId: string): WorkflowNode | null => canvas.nodes.find((node) => node.id === nodeId) ?? null;
  let node: WorkflowNode | null = canvas.nodes.find((item) => item.type === "trigger") ?? canvas.nodes[0] ?? null;
  let safety = 0;
  while (node && safety < MAX_STEPS) {
    safety += 1;
    currentNodeId = node.id;
    const label = node.label;
    let result: NodeResult | null = null;

    if (node.type === "trigger") {
      pushLog(node.id, label, "success", `${label}: inscripción iniciada en el servidor.`);
    } else if (node.type === "branch") {
      pushLog(node.id, label, "skipped", `${label}: esperando respuesta del contacto (Time Out: 24 h).`);
      status = "active";
      waitExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      break;
    } else if (label.startsWith("Enviar WhatsApp")) {
      result = await executeSendWhatsapp(admin, workflow, contact, node);
    } else if (label.startsWith("Activar Bot")) {
      const conversationId = await ensureConversation(admin, workflow, contact);
      const botCheck = await admin.from("ai_bots").select("id").eq("tenant_id", workflow.tenant_id)
        .eq("is_active", true).neq("provider", "integrated").limit(1);
      if ((botCheck.data ?? []).length === 0) {
        result = { outcome: "error", detail: "No hay un Bot IA activo con proveedor configurado en este workspace." };
      } else {
        const { error } = await admin.from("conversations").update({ handler_mode: "bot" }).eq("id", conversationId).eq("tenant_id", workflow.tenant_id);
        result = error
          ? { outcome: "error", detail: `No se pudo activar el Bot IA: ${error.message}` }
          : { outcome: "success", detail: "Conversación puesta en modo Bot IA: el bot atenderá al cliente desde su próximo mensaje." };
      }
    } else if (label.startsWith("Marcar en seguimiento")) {
      const { error } = await admin.from("contacts").update({ is_starred: true, updated_at: now })
        .eq("id", contact.id).eq("tenant_id", workflow.tenant_id);
      result = error
        ? { outcome: "error", detail: `No se pudo marcar el seguimiento: ${error.message}` }
        : { outcome: "success", detail: "Contacto marcado con ⭐ seguimiento." };
    } else if (label.startsWith("Mover a") || label.startsWith("Crear oportunidad")) {
      result = await executeStageAction(admin, workflow, contact, node, now);
    } else if (label.startsWith("Asignar a un miembro")) {
      result = await executeRoundRobinAssignment(admin, workflow, contact, node, now);
    } else {
      result = { outcome: "skipped", detail: `Acción «${label}» registrada sin efectos en el servidor.` };
    }

    if (result) {
      pushLog(node.id, label, result.outcome, result.detail);
      if (result.outcome === "error") { status = "failed"; break; }
    }
    const nextEdge = canvas.edges.find((edge) => edge.source_node_id === node!.id && edge.label === null);
    node = nextEdge ? nodeById(nextEdge.target_node_id) : null;
  }

  const { error: enrollmentError } = await admin.from("workflow_enrollments").insert({
    tenant_id: workflow.tenant_id,
    workflow_id: workflow.id,
    contact_id: contact.id,
    current_node_id: currentNodeId,
    status,
    wait_expires_at: waitExpiresAt,
    execution_logs: logs,
    completed_at: status === "completed" ? now : null,
  });
  if (enrollmentError) throw new Error(`Supabase workflow_enrollments: ${enrollmentError.message}`);

  await admin.from("workflows").update({ enrolled_count: workflow.enrolled_count + 1, updated_at: now }).eq("id", workflow.id);
  const { count } = await admin.from("workflow_enrollments").select("id", { count: "exact", head: true })
    .eq("workflow_id", workflow.id).neq("status", "completed");
  await admin.from("workflows").update({ active_count: count ?? 0 }).eq("id", workflow.id);
  await admin.from("contact_activities").insert({
    tenant_id: workflow.tenant_id,
    contact_id: contact.id,
    actor_member_id: null,
    activity_type: "workflow",
    description: `Workflow «${workflow.name}» ejecutado en el servidor (${status === "completed" ? "completado" : status === "failed" ? "con errores" : "en espera de respuesta"}).`,
    metadata: {},
  });
}

/* ----------------------------------------------------------------------------
 * Nodos de acción
 * -------------------------------------------------------------------------- */

async function ensureConversation(admin: Admin, workflow: Workflow, contact: Contact): Promise<string> {
  const { data: existing } = await admin.from("conversations").select("id")
    .eq("tenant_id", workflow.tenant_id).eq("contact_id", contact.id)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await admin.from("conversations").insert({
    tenant_id: workflow.tenant_id,
    contact_id: contact.id,
    assigned_member_id: contact.assigned_member_id,
    channel: "whatsapp",
    handler_mode: "human",
  }).select("id").single();
  if (error || !created) throw new Error(`Supabase conversations: ${error?.message ?? "sin id"}`);
  return created.id as string;
}

async function executeSendWhatsapp(admin: Admin, workflow: Workflow, contact: Contact, node: WorkflowNode): Promise<NodeResult> {
  const templateName = (node.config.template ?? "").trim();
  if (!templateName) return { outcome: "error", detail: "El paso no tiene plantilla configurada." };
  const { data: template } = await admin.from("whatsapp_templates").select("name,language,body_text,variables_count,status")
    .eq("tenant_id", workflow.tenant_id).eq("name", templateName).eq("status", "APPROVED").maybeSingle();
  if (!template) return { outcome: "error", detail: `La plantilla "${templateName}" no existe o no está aprobada.` };
  if (contact.opt_out_marketing) return { outcome: "skipped", detail: "El contacto pidió no recibir más mensajes (opt-out)." };

  const variables = buildTemplateVariables(contact, template.variables_count);
  if (variables.some((value) => !value)) return { outcome: "error", detail: "Faltan valores variable_N del contacto para completar la plantilla." };

  const conversationId = await ensureConversation(admin, workflow, contact);
  const preview = variables.reduce((text, value, index) => text.replaceAll(`{{${index + 1}}}`, value), template.body_text as string);
  const now = new Date().toISOString();
  const { data: pending, error: insertError } = await admin.from("messages").insert({
    tenant_id: workflow.tenant_id,
    conversation_id: conversationId,
    sender_member_id: null,
    direction: "outbound",
    msg_type: "template",
    body: preview,
    template_name: template.name,
    status: "queued",
  }).select("id").single();
  if (insertError || !pending) return { outcome: "error", detail: `No se pudo registrar el mensaje: ${insertError?.message ?? "sin id"}` };

  try {
    const waMessageId = await sendMetaTemplate(workflow.tenant_id, contact.phone_e164, {
      name: template.name as string,
      language: template.language as string,
    }, variables);
    await admin.from("messages").update({ wa_message_id: waMessageId, status: "sent" }).eq("id", pending.id as string);
    await admin.from("conversations").update({
      last_message_at: now, last_message_preview: preview.slice(0, 120), last_message_media_type: "template",
      needs_reply: false, unread_count: 0,
    }).eq("id", conversationId);
    await admin.from("contacts").update({ last_interaction_at: now }).eq("id", contact.id);
    return { outcome: "success", detail: `Plantilla "${templateName}" enviada por WhatsApp.` };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 500) : "Error de envío";
    await admin.from("messages").update({ status: "failed", error_reason: reason }).eq("id", pending.id as string);
    return { outcome: "error", detail: `Meta rechazó el envío: ${reason}` };
  }
}

async function executeStageAction(admin: Admin, workflow: Workflow, contact: Contact, node: WorkflowNode, now: string): Promise<NodeResult> {
  const stageId = (node.config.stage_id ?? "").trim();
  if (!stageId) return { outcome: "error", detail: "El paso no tiene etapa del pipeline configurada." };
  const { data: stage } = await admin.from("pipeline_stages").select("*")
    .eq("id", stageId).eq("tenant_id", workflow.tenant_id).maybeSingle();
  if (!stage) return { outcome: "error", detail: `Etapa no encontrada (stage_id: ${stageId}).` };
  const stageRow = stage as PipelineStage;

  const { data: open } = await admin.from("opportunities").select("id")
    .eq("tenant_id", workflow.tenant_id).eq("contact_id", contact.id)
    .eq("pipeline_id", stageRow.pipeline_id).eq("status", "open").limit(1).maybeSingle();
  const isMove = node.label.startsWith("Mover a");

  if (isMove && open?.id) {
    const { error } = await admin.from("opportunities").update({
      stage_id: stageRow.id,
      status: stageRow.stage_category,
      closed_at: stageRow.stage_category === "open" ? null : now,
      updated_at: now,
    }).eq("id", open.id as string).eq("tenant_id", workflow.tenant_id);
    if (error) return { outcome: "error", detail: `No se pudo mover la oportunidad: ${error.message}` };
  } else {
    if (open?.id) return { outcome: "skipped", detail: `El contacto ya tiene una oportunidad abierta en «${stageRow.name}».` };
    const monetaryValue = Number(node.config.monetary_value ?? "") || 0;
    const { error } = await admin.from("opportunities").insert({
      tenant_id: workflow.tenant_id,
      contact_id: contact.id,
      pipeline_id: stageRow.pipeline_id,
      stage_id: stageRow.id,
      assigned_member_id: contact.assigned_member_id,
      title: (node.config.opportunity_title ?? "").trim() || `Oportunidad de «${workflow.name}»`,
      monetary_value: monetaryValue,
      status: "open",
      closed_at: null,
    });
    if (error) return { outcome: "error", detail: `No se pudo crear la oportunidad: ${error.message}` };
  }
  if (stageRow.stage_category === "lost") {
    await admin.from("contacts").update({ typification: "Cliente perdido", updated_at: now }).eq("id", contact.id);
  }
  return isMove && open?.id
    ? { outcome: "success", detail: `Oportunidad movida a la etapa «${stageRow.name}».` }
    : { outcome: "success", detail: `Oportunidad creada en la etapa «${stageRow.name}».` };
}

async function executeRoundRobinAssignment(admin: Admin, workflow: Workflow, contact: Contact, node: WorkflowNode, now: string): Promise<NodeResult> {
  const memberFilter = (node.config.miembros ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  let query = admin.from("tenant_members").select("id,email")
    .eq("tenant_id", workflow.tenant_id).eq("is_active", true).eq("role", "agent");
  if (memberFilter.length > 0) query = query.in("id", memberFilter);
  /* Reparto equitativo: el agente con last_assigned_at más antiguo (los que
     nunca han recibido un lead van primero). */
  const { data: candidates, error } = await query
    .order("last_assigned_at", { ascending: true, nullsFirst: true })
    .limit(1);
  if (error) return { outcome: "error", detail: `No se pudo consultar el equipo: ${error.message}` };
  const pick = candidates?.[0] ?? null;
  if (!pick) return { outcome: "error", detail: "No hay agentes activos disponibles para el reparto Round Robin." };

  await admin.from("tenant_members").update({ last_assigned_at: now }).eq("id", pick.id as string);
  await admin.from("contacts").update({ assigned_member_id: pick.id, updated_at: now })
    .eq("id", contact.id).eq("tenant_id", workflow.tenant_id);
  await admin.from("conversations").update({ assigned_member_id: pick.id })
    .eq("contact_id", contact.id).eq("tenant_id", workflow.tenant_id);
  await admin.from("opportunities").update({ assigned_member_id: pick.id })
    .eq("contact_id", contact.id).eq("status", "open").eq("tenant_id", workflow.tenant_id);
  return { outcome: "success", detail: `Reparto Round Robin → ${pick.email}.` };
}
