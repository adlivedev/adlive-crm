import "server-only";

import { sendWorkspaceEmail } from "@/shared/lib/mail/smtpMailer";
import { createAdminClient } from "@/shared/lib/supabase/admin";

import { createNotification } from "./notificationService";

/** Correos solo para eventos prioritarios; si el SMTP global no está
 *  configurado, se registra y se continúa sin romper el flujo principal. */
async function sendPriorityEmail(input: { tenantId: string; to: string[]; subject: string; html: string }): Promise<void> {
  try {
    await sendWorkspaceEmail({ tenantId: input.tenantId, to: input.to, subject: input.subject, html: input.html });
  } catch (error) {
    console.error("[notifications] No se pudo enviar el correo prioritario:", error instanceof Error ? error.message : error);
  }
}

async function memberEmails(tenantId: string, memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const { data } = await createAdminClient().from("tenant_members").select("email").eq("tenant_id", tenantId).in("id", memberIds).eq("is_active", true);
  return (data ?? []).map((row) => row.email).filter(Boolean);
}

/** Mensaje entrante en un chat asignado: notifica al agente (campana) y, si es
 *  una conversación humana pendiente, programa la alerta de SLA (>1 h). */
export async function notifyInboundMessage(tenantId: string, waMessageId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: message } = await admin.from("messages")
    .select("id,conversation_id,body,msg_type").eq("wa_message_id", waMessageId).eq("tenant_id", tenantId).eq("direction", "inbound").maybeSingle();
  if (!message) return;
  const { data: conversation } = await admin.from("conversations")
    .select("id,contact_id,assigned_member_id,handler_mode").eq("id", message.conversation_id).eq("tenant_id", tenantId).maybeSingle();
  if (!conversation?.assigned_member_id || conversation.handler_mode !== "human") return;
  const { data: contact } = await admin.from("contacts").select("full_name").eq("id", conversation.contact_id).eq("tenant_id", tenantId).maybeSingle();
  const preview = message.body ? message.body.slice(0, 80) : message.msg_type === "audio" ? "Te envió un audio" : "Te envió un mensaje";
  await createNotification({
    tenantId,
    recipientMemberId: conversation.assigned_member_id,
    type: "inbound_message",
    title: `Nuevo mensaje de ${contact?.full_name ?? "un contacto"}`,
    body: preview,
    actionUrl: `/conversaciones?open=${conversation.id}`,
    metadata: { conversation_id: conversation.id, message_id: message.id },
  });
}

/** Encola (con deduplicación) la alerta de conversación sin respuesta humana. */
export async function enqueueSlaAlertJob(tenantId: string, conversationId: string, hours = 1): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("background_jobs").select("id")
    .eq("tenant_id", tenantId).eq("job_type", "conversation_sla_alert").eq("status", "pending")
    .contains("payload", { conversation_id: conversationId }).limit(1).maybeSingle();
  if (existing) return;
  await admin.from("background_jobs").insert({
    tenant_id: tenantId,
    job_type: "conversation_sla_alert",
    payload: { conversation_id: conversationId, hours },
    run_after: new Date(Date.now() + hours * 3_600_000).toISOString(),
  });
}

/** Asegura un (1) trabajo de resumen diario pendiente para el workspace. */
export async function ensureDailySummaryJob(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("background_jobs").select("id")
    .eq("tenant_id", tenantId).eq("job_type", "daily_summary").eq("status", "pending")
    .limit(1).maybeSingle();
  if (existing) return;
  const tomorrow = new Date();
  tomorrow.setHours(9, 0, 0, 0);
  if (tomorrow.getTime() <= Date.now()) tomorrow.setDate(tomorrow.getDate() + 1);
  await admin.from("background_jobs").insert({
    tenant_id: tenantId,
    job_type: "daily_summary",
    payload: {},
    run_after: tomorrow.toISOString(),
  });
}

/** Lead asignado: correo prioritario directo y natural para el agente. */
export async function emailLeadAssigned(input: { tenantId: string; contactId: string; contactName: string; memberId: string | null }): Promise<void> {
  if (!input.memberId) return;
  const [to] = await memberEmails(input.tenantId, [input.memberId]);
  if (!to) return;
  await sendPriorityEmail({
    tenantId: input.tenantId,
    to: [to],
    subject: `${input.contactName} quedó asignado a ti`,
    html: `<p>Hola,</p><p><strong>${input.contactName}</strong> acaba de llegar y quedó en tu bandeja para seguimiento.</p><p>Entra al CRM y escríbele pronto: mientras más rápido respondas, más probable es que cierre.</p><p style="margin-top:24px;"><a href="/contactos/${input.contactId}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">Ver contacto</a></p>`,
  });
}

/** Alerta de chat sin respuesta: correo prioritario al agente/admin correspondiente. */
export async function emailSlaAlert(input: { tenantId: string; memberId: string | null; conversationId: string; hours: number; contactName: string }): Promise<void> {
  const recipients = input.memberId ? [input.memberId] : [];
  const { data: admins } = await createAdminClient().from("tenant_members").select("id").eq("tenant_id", input.tenantId).eq("is_active", true).in("role", ["owner", "admin"]);
  const to = await memberEmails(input.tenantId, [...recipients, ...(admins ?? []).map((row) => row.id)]);
  if (to.length === 0) return;
  await sendPriorityEmail({
    tenantId: input.tenantId,
    to,
    subject: `Un chat lleva más de ${input.hours} h sin respuesta`,
    html: `<p>Hola,</p><p>La conversación con <strong>${input.contactName}</strong> lleva más de <strong>${input.hours} hora(s)</strong> sin respuesta humana y el cliente sigue esperando.</p><p>Entra y respóndele cuanto antes para no perder el lead.</p><p style="margin-top:24px;"><a href="/conversaciones?open=${input.conversationId}" style="display:inline-block;background:#DC2626;color:#FFFFFF;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">Responder ahora</a></p>`,
  });
}

/** Resumen diario de contactos creados hoy con su origen (formulario/UTM). */
export async function sendDailySummary(tenantId: string): Promise<number> {
  const admin = createAdminClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data: contacts } = await admin.from("contacts")
    .select("id,full_name,lead_source,created_at").eq("tenant_id", tenantId).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(100);
  const created = contacts ?? [];
  const { data: owners } = await admin.from("tenant_members").select("id,email").eq("tenant_id", tenantId).eq("is_active", true).in("role", ["owner", "admin"]);
  const to = (owners ?? []).map((row) => row.email).filter(Boolean);
  if (to.length === 0) return 0;
  const bySource = created.reduce<Record<string, number>>((acc, contact) => {
    acc[contact.lead_source ?? "Otro"] = (acc[contact.lead_source ?? "Otro"] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(bySource).map(([source, count]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${source}</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:bold;">${count}</td></tr>`).join("");
  const contactList = created.slice(0, 10).map((contact) => `<li style="margin:4px 0;">${contact.full_name} <span style="color:#6B7280;">(${contact.lead_source ?? "Otro"})</span></li>`).join("");
  await sendPriorityEmail({
    tenantId,
    to,
    subject: `Resumen diario: ${created.length} contacto(s) nuevo(s) hoy`,
    html: `<p>Hola,</p><p>Hoy se crearon <strong>${created.length} contacto(s)</strong> en el workspace. Este es el desglose por origen:</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr><th style="text-align:left;padding:8px 12px;background:#F9FAFB;">Origen</th><th style="text-align:right;padding:8px 12px;background:#F9FAFB;">Contactos</th></tr></thead><tbody>${rows || `<tr><td colspan="2" style="padding:12px;text-align:center;color:#6B7280;">Sin contactos hoy</td></tr>`}</tbody></table>${created.length ? `<p>Últimos contactos:</p><ul style="padding-left:18px;">${contactList}</ul>` : ""}<p style="color:#6B7280;font-size:13px;">Recibes este resumen una vez al día. Puedes desactivarlo desde los ajustes del workspace.</p>`,
  });
  return created.length;
}
