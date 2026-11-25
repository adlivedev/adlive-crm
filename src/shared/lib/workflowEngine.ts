/**
 * MOTOR PUERO DE WORKFLOWS — helpers compartidos entre cliente y servidor.
 *
 * Funciones sin efectos secundarios: siembra del nodo disparador, reglas de
 * publicación, filtro del disparador por landing/campaña/etiqueta, selección
 * Round Robin y armado de los lienzos de las plantillas recomendadas.
 * Sin "use client" ni "server-only": lo usan la UI, el servicio de ejecución
 * del servidor y las pruebas unitarias.
 */

import type {
  TenantMember,
  Workflow,
  WorkflowCanvasDefinition,
  WorkflowNode,
  WorkflowStatus,
  WorkflowTriggerType,
} from "@/shared/types/database";

/* ----------------------------------------------------------------------------
 * Etiquetas de disparador (QA-007: español, con propósito comercial explícito)
 * -------------------------------------------------------------------------- */

export const TRIGGER_NODE_LABELS: Record<WorkflowTriggerType, string> = {
  manual_enrollment: "Inscripción manual",
  contact_created: "Contacto creado / Formulario Web",
  channel_message_received: "Mensaje recibido en WhatsApp",
  sla_no_response: "SLA: sin respuesta del agente",
};

/** Configuración descriptiva sembrada en el nodo disparador según su tipo. */
export function triggerNodeConfig(triggerType: WorkflowTriggerType): Record<string, string> {
  switch (triggerType) {
    case "contact_created":
      return { origen: "Se dispara al crear un contacto desde formulario o landing" };
    case "channel_message_received":
      return { canal: "WhatsApp", origen: "Se dispara al llegar el primer mensaje del lead" };
    case "sla_no_response":
      return { origen: "Se dispara cuando una conversación humana supera el tiempo SLA sin respuesta", sla_minutes: "60" };
    default:
      return { origen: "Inscripción manual desde Contactos" };
  }
}

/** Construye el nodo disparador sembrado al crear el workflow (QA-001). */
export function buildTriggerNode(
  triggerType: WorkflowTriggerType,
  id: string,
): WorkflowNode {
  return {
    id,
    type: "trigger",
    label: TRIGGER_NODE_LABELS[triggerType],
    config: triggerNodeConfig(triggerType),
    position: { x: 0, y: 0 },
  };
}

/** Lienzo inicial: siembra el disparador en lugar de dejar el lienzo vacío. */
export function seedTriggerCanvas(
  triggerType: WorkflowTriggerType,
  nodeId: string,
): WorkflowCanvasDefinition {
  return { nodes: [buildTriggerNode(triggerType, nodeId)], edges: [] };
}

/* ----------------------------------------------------------------------------
 * Regla de publicación (al menos 1 disparador y 1 acción configurados)
 * -------------------------------------------------------------------------- */

/**
 * Devuelve el motivo que bloquea la publicación, o null si el workflow puede
 * publicarse. Exige al menos un nodo disparador y una acción en el lienzo.
 */
export function workflowPublishBlockReason(
  workflow: Pick<Workflow, "canvas_definition">,
): string | null {
  const nodes = workflow.canvas_definition.nodes;
  const hasTrigger = nodes.some((node) => node.type === "trigger");
  const hasAction = nodes.some((node) => node.type === "action");
  if (!hasTrigger) return "Agrega al menos un disparador inicial antes de publicar el workflow.";
  if (!hasAction) return "Agrega al menos una acción (por ejemplo, Enviar WhatsApp o Asignar) antes de publicar.";
  return null;
}

/** Etiqueta legible del estado del workflow (QA-007). */
export function workflowStatusLabel(status: WorkflowStatus): string {
  return status === "Published" ? "Publicado" : "Borrador";
}

/* ----------------------------------------------------------------------------
 * Filtro opcional del disparador: landing, campaña o etiqueta
 * -------------------------------------------------------------------------- */

export type TriggerFilterType = "ninguno" | "campania" | "landing" | "etiqueta" | "formulario";

export const TRIGGER_FILTER_LABELS: Record<TriggerFilterType, string> = {
  ninguno: "Sin filtro (cualquier origen)",
  campania: "Campaña UTM",
  landing: "Landing o URL",
  etiqueta: "Etiqueta del contacto",
  formulario: "Formulario específico",
};

export interface TriggerFilterContext {
  utmCampaign?: string | null;
  landingUrl?: string | null;
  tags?: string[];
  formName?: string | null;
}

/** Evalúa el filtro configurado en el nodo disparador contra el contexto del evento. */
export function triggerFilterMatches(
  config: Record<string, string>,
  context: TriggerFilterContext,
): boolean {
  const tipo = (config.filtro_tipo ?? "ninguno") as TriggerFilterType;
  const valor = (config.filtro_valor ?? "").trim().toLowerCase();
  if (tipo === "ninguno" || !valor) return true;
  if (tipo === "campania") return (context.utmCampaign ?? "").toLowerCase().includes(valor);
  if (tipo === "landing") return (context.landingUrl ?? "").toLowerCase().includes(valor);
  if (tipo === "formulario") return (context.formName ?? "").toLowerCase().includes(valor);
  return (context.tags ?? []).some((tag) => tag.trim().toLowerCase() === valor);
}

/* ----------------------------------------------------------------------------
 * Reparto equitativo Round Robin (NULLS FIRST, último asignado más antiguo)
 * -------------------------------------------------------------------------- */

type RoundRobinCandidate = Pick<TenantMember, "last_assigned_at">;

/**
 * Elige al agente que lleva más tiempo sin recibir un lead: ordena por
 * `last_assigned_at` ascendente tratando los NULL (nunca asignados) como los
 * más antiguos; los empates se resuelven por el orden del arreglo.
 */
export function pickRoundRobinMember<T extends RoundRobinCandidate>(members: T[]): T | null {
  if (members.length === 0) return null;
  return members.reduce((oldest, member) => {
    const oldestKey = oldest.last_assigned_at ?? "";
    const memberKey = member.last_assigned_at ?? "";
    return memberKey < oldestKey ? member : oldest;
  });
}

/* ----------------------------------------------------------------------------
 * Plantillas recomendadas de creación en 1 clic
 * -------------------------------------------------------------------------- */

function actionNode(id: string, y: number, label: string, config: Record<string, string>): WorkflowNode {
  return { id, type: "action", label, config, position: { x: 0, y } };
}

function linearEdge(id: string, source: string, target: string) {
  return { id, source_node_id: source, target_node_id: target, label: null };
}

/**
 * Plantilla 1 — «Bienvenida automática de formulario + Aviso de asesor»:
 * Disparador Contacto creado/Formulario → Enviar plantilla WhatsApp →
 * Mover a la etapa de interés → Asignar Round Robin entre agentes activos.
 */
export function buildWelcomeTemplateCanvas(input: {
  triggerType: WorkflowTriggerType;
  templateName: string | null;
  stageId: string | null;
  stageName: string;
}): WorkflowCanvasDefinition {
  const nodes: WorkflowNode[] = [buildTriggerNode(input.triggerType, "tpl-t1")];
  const edges: WorkflowCanvasDefinition["edges"] = [];
  if (input.templateName) {
    nodes.push(actionNode("tpl-a1", 150, "Enviar WhatsApp", { template: input.templateName }));
    edges.push(linearEdge("tpl-e1", "tpl-t1", "tpl-a1"));
  }
  if (input.stageId) {
    const moveId = nodes.length > 1 ? "tpl-a2" : "tpl-a1";
    nodes.push(actionNode(moveId, nodes.length * 150, `Mover a ${input.stageName}`, { stage_id: input.stageId, stage_name: input.stageName }));
    edges.push(linearEdge(`tpl-e${edges.length + 1}`, nodes[nodes.length - 2]!.id, moveId));
  }
  const assignId = `tpl-a${nodes.length}`;
  nodes.push(actionNode(assignId, nodes.length * 150, "Asignar a un miembro (Round robin)", { modo: "round_robin" }));
  edges.push(linearEdge(`tpl-e${edges.length + 1}`, nodes[nodes.length - 2]!.id, assignId));
  return { nodes, edges };
}

/**
 * Plantilla 2 — «Reparto equitativo entre agentes activos (Round Robin)»:
 * Disparador Mensaje recibido → Marcar en seguimiento → Asignar equitativamente.
 */
export function buildRoundRobinTemplateCanvas(triggerType: WorkflowTriggerType): WorkflowCanvasDefinition {
  return {
    nodes: [
      buildTriggerNode(triggerType, "tpl-t1"),
      actionNode("tpl-a1", 150, "Marcar en seguimiento", {}),
      actionNode("tpl-a2", 300, "Asignar a un miembro (Round robin)", { modo: "round_robin" }),
    ],
    edges: [linearEdge("tpl-e1", "tpl-t1", "tpl-a1"), linearEdge("tpl-e2", "tpl-a1", "tpl-a2")],
  };
}
