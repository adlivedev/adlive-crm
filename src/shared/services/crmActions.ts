/**
 * CAPA ADAPTADORA — Acciones puras de mutación del estado CRM (Etapa A).
 *
 * Todas las funciones reciben el estado actual y devuelven un estado NUEVO
 * (inmutable), listas para usarse con useReducer/useState. En la Etapa B
 * (Supabase vía MCP) solo se reemplaza esta capa; la UI no cambia.
 */

import type {
  AiBot,
  AiBotProvider,
  Contact,
  CustomFieldType,
  IntegrationProvider,
  MessageType,
  PipelineStage,
  StageType,
  UserRole,
  WhatsAppTemplateButton,
  WorkflowEnrollment,
  WorkflowExecutionLogEntry,
  WorkflowTriggerType,
} from "@/shared/types/database";
import type { CrmInitialData } from "@/shared/mocks/initialData";
import { seedTriggerCanvas } from "@/shared/lib/workflowEngine";

export interface StatsDelta {
  totalContacts: number;
  openOpportunities: number;
  revenue: number;
  unanswered: number;
  stageCounts: Record<string, number>;
  monthly: Record<string, { ganadas: number; perdidas: number }>;
}

export interface CrmState {
  data: CrmInitialData;
  statsDelta: Record<string, StatsDelta>;
}

export const EMPTY_STATS_DELTA: StatsDelta = {
  totalContacts: 0,
  openOpportunities: 0,
  revenue: 0,
  unanswered: 0,
  stageCounts: {},
  monthly: {},
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneState(state: CrmState): CrmState {
  return {
    data: structuredClone(state.data),
    statsDelta: structuredClone(state.statsDelta),
  };
}

/**
 * Devuelve el delta mutable del tenant, creándolo sobre el estado clonado
 * si aún no existe (nunca sobre la constante compartida EMPTY_STATS_DELTA).
 */
function deltaOf(state: CrmState, tenantId: string): StatsDelta {
  if (!state.statsDelta[tenantId]) {
    state.statsDelta[tenantId] = structuredClone(EMPTY_STATS_DELTA);
  }
  return state.statsDelta[tenantId];
}

function addActivity(
  data: CrmInitialData,
  tenantId: string,
  contactId: string,
  actorMemberId: string | null,
  activityType: string,
  description: string,
  metadata: Record<string, string> = {},
): void {
  data.contactActivities.unshift({
    id: newId("a"),
    tenant_id: tenantId,
    contact_id: contactId,
    actor_member_id: actorMemberId,
    activity_type: activityType,
    description,
    metadata,
    created_at: nowIso(),
  });
}

function monthlyOf(delta: StatsDelta): Record<string, { ganadas: number; perdidas: number }> {
  const key = currentMonthKey();
  if (!delta.monthly[key]) {
    delta.monthly[key] = { ganadas: 0, perdidas: 0 };
  }
  return delta.monthly;
}

/* ============================================================================
 * CONTACTOS
 * ========================================================================== */

export interface CreateContactInput {
  full_name: string;
  phone_e164: string;
  email?: string | null;
  company_name?: string | null;
  lead_source?: string;
  tags?: string[];
  assigned_member_id?: string | null;
}

export function createContact(
  state: CrmState,
  tenantId: string,
  actorMemberId: string | null,
  input: CreateContactInput,
): CrmState {
  const next = cloneState(state);
  const timestamp = nowIso();
  const contact: Contact = {
    id: newId("c"),
    tenant_id: tenantId,
    assigned_member_id: input.assigned_member_id ?? null,
    full_name: input.full_name.trim(),
    phone_e164: input.phone_e164.trim(),
    email: input.email?.trim() || null,
    company_name: input.company_name?.trim() || null,
    lead_source: input.lead_source ?? "WhatsApp",
    tags: input.tags ?? [],
    custom_fields: {},
    is_closed_client: false,
    is_starred: false,
    typification: null,
    opt_out_marketing: false,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    fbclid: null,
    landing_url: null,
    referrer_url: null,
    last_interaction_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
  next.data.contacts.unshift(contact);
  const delta = deltaOf(next, tenantId);
  delta.totalContacts += 1;
  addActivity(next.data, tenantId, contact.id, actorMemberId, "creation", `Contacto creado manualmente: ${contact.full_name}.`);
  return next;
}

export function updateContact(
  state: CrmState,
  contactId: string,
  patch: Partial<Pick<Contact, "full_name" | "phone_e164" | "email" | "company_name" | "lead_source" | "tags" | "custom_fields" | "assigned_member_id">>,
): CrmState {
  const next = cloneState(state);
  const contact = next.data.contacts.find((c) => c.id === contactId);
  if (!contact) return state;
  Object.assign(contact, patch, { updated_at: nowIso() });
  return next;
}

export function deleteContact(state: CrmState, contactId: string): CrmState {
  const next = cloneState(state);
  const contact = next.data.contacts.find((c) => c.id === contactId);
  if (!contact) return state;
  const tenantId = contact.tenant_id;
  const delta = deltaOf(next, tenantId);

  const openOpps = next.data.opportunities.filter((o) => o.contact_id === contactId && o.status === "open");
  delta.totalContacts -= 1;
  delta.openOpportunities -= openOpps.length;
  for (const opp of openOpps) {
    delta.stageCounts[opp.stage_id] = (delta.stageCounts[opp.stage_id] ?? 0) - 1;
  }
  const convs = next.data.conversations.filter((cv) => cv.contact_id === contactId);
  const unansweredRemoved = convs.filter((cv) => cv.needs_reply).length;
  delta.unanswered -= unansweredRemoved;
  const convIds = new Set(convs.map((cv) => cv.id));

  next.data.contacts = next.data.contacts.filter((c) => c.id !== contactId);
  next.data.opportunities = next.data.opportunities.filter((o) => o.contact_id !== contactId);
  next.data.conversations = next.data.conversations.filter((cv) => cv.contact_id !== contactId);
  next.data.messages = next.data.messages.filter((m) => !convIds.has(m.conversation_id));
  next.data.contactNotes = next.data.contactNotes.filter((n) => n.contact_id !== contactId);
  next.data.contactTasks = next.data.contactTasks.filter((t) => t.contact_id !== contactId);
  next.data.contactActivities = next.data.contactActivities.filter((a) => a.contact_id !== contactId);
  return next;
}

export function toggleContactStar(state: CrmState, contactId: string): CrmState {
  const next = cloneState(state);
  const contact = next.data.contacts.find((c) => c.id === contactId);
  if (!contact) return state;
  contact.is_starred = !contact.is_starred;
  contact.updated_at = nowIso();
  return next;
}

export function setContactTypification(state: CrmState, contactId: string, typification: string | null): CrmState {
  const next = cloneState(state);
  const contact = next.data.contacts.find((c) => c.id === contactId);
  if (!contact) return state;
  contact.typification = typification;
  contact.updated_at = nowIso();
  addActivity(next.data, contact.tenant_id, contactId, null, "typification", `Tipificación actualizada: ${typification ?? "sin tipificar"}.`);
  return next;
}

/* ============================================================================
 * OPORTUNIDADES (KANBAN)
 * ========================================================================== */

export function moveOpportunityToStage(
  state: CrmState,
  opportunityId: string,
  targetStageId: string,
  stages: PipelineStage[],
): CrmState {
  const next = cloneState(state);
  const opp = next.data.opportunities.find((o) => o.id === opportunityId);
  const targetStage = stages.find((s) => s.id === targetStageId);
  if (!opp || !targetStage || opp.stage_id === targetStageId) return state;

  const tenantId = opp.tenant_id;
  const delta = deltaOf(next, tenantId);
  const oldStatus: StageType = opp.status;
  const newStatus: StageType = targetStage.stage_category;
  const timestamp = nowIso();

  if (oldStatus === "open" && newStatus === "open") {
    delta.stageCounts[opp.stage_id] = (delta.stageCounts[opp.stage_id] ?? 0) - 1;
    delta.stageCounts[targetStageId] = (delta.stageCounts[targetStageId] ?? 0) + 1;
  } else if (oldStatus === "open" && newStatus === "won") {
    delta.stageCounts[opp.stage_id] = (delta.stageCounts[opp.stage_id] ?? 0) - 1;
    delta.openOpportunities -= 1;
    delta.revenue += opp.monetary_value;
    monthlyOf(delta)[currentMonthKey()]!.ganadas += 1;
  } else if (oldStatus === "open" && newStatus === "lost") {
    delta.stageCounts[opp.stage_id] = (delta.stageCounts[opp.stage_id] ?? 0) - 1;
    delta.openOpportunities -= 1;
    monthlyOf(delta)[currentMonthKey()]!.perdidas += 1;
  } else if (oldStatus !== "open" && newStatus === "open") {
    delta.openOpportunities += 1;
    delta.stageCounts[targetStageId] = (delta.stageCounts[targetStageId] ?? 0) + 1;
    if (oldStatus === "won") {
      delta.revenue -= opp.monetary_value;
      monthlyOf(delta)[currentMonthKey()]!.ganadas -= 1;
    } else {
      monthlyOf(delta)[currentMonthKey()]!.perdidas -= 1;
    }
  }

  opp.stage_id = targetStageId;
  opp.status = newStatus;
  opp.closed_at = newStatus === "open" ? null : timestamp;
  opp.updated_at = timestamp;

  if (newStatus === "won") {
    const contact = next.data.contacts.find((c) => c.id === opp.contact_id);
    if (contact) {
      contact.is_closed_client = true;
      contact.typification = "Cliente cerrado";
      contact.updated_at = timestamp;
    }
  }
  addActivity(next.data, tenantId, opp.contact_id, opp.assigned_member_id, "stage_change", `Oportunidad «${opp.title}» movida a «${targetStage.name}».`);
  return next;
}

export function createOpportunity(
  state: CrmState,
  tenantId: string,
  input: { contact_id: string; pipeline_id: string; stage_id: string; title: string; monetary_value: number; assigned_member_id?: string | null },
): CrmState {
  const next = cloneState(state);
  const timestamp = nowIso();
  next.data.opportunities.unshift({
    id: newId("o"),
    tenant_id: tenantId,
    contact_id: input.contact_id,
    pipeline_id: input.pipeline_id,
    stage_id: input.stage_id,
    assigned_member_id: input.assigned_member_id ?? null,
    title: input.title,
    monetary_value: input.monetary_value,
    status: "open",
    closed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  });
  const delta = deltaOf(next, tenantId);
  delta.openOpportunities += 1;
  delta.stageCounts[input.stage_id] = (delta.stageCounts[input.stage_id] ?? 0) + 1;
  addActivity(next.data, tenantId, input.contact_id, input.assigned_member_id ?? null, "opportunity", `Oportunidad creada: ${input.title}.`);
  return next;
}

export function deleteOpportunity(state: CrmState, opportunityId: string): CrmState {
  const next = cloneState(state);
  const opp = next.data.opportunities.find((o) => o.id === opportunityId);
  if (!opp) return state;
  const delta = deltaOf(next, opp.tenant_id);
  if (opp.status === "open") {
    delta.openOpportunities -= 1;
    delta.stageCounts[opp.stage_id] = (delta.stageCounts[opp.stage_id] ?? 0) - 1;
  } else if (opp.status === "won") {
    delta.revenue -= opp.monetary_value;
  }
  next.data.opportunities = next.data.opportunities.filter((o) => o.id !== opportunityId);
  return next;
}

/* ============================================================================
 * CONVERSACIONES Y MENSAJES
 * ========================================================================== */

export interface SendMessageInput {
  body: string;
  msg_type?: MessageType;
  template_name?: string | null;
  sender_member_id?: string | null;
}

export function sendMessage(state: CrmState, conversationId: string, input: SendMessageInput): CrmState {
  const next = cloneState(state);
  const conversation = next.data.conversations.find((cv) => cv.id === conversationId);
  if (!conversation) return state;
  const timestamp = nowIso();
  const msgType = input.msg_type ?? "text";

  next.data.messages.push({
    id: newId("ms"),
    tenant_id: conversation.tenant_id,
    conversation_id: conversationId,
    sender_member_id: input.sender_member_id ?? null,
    wa_message_id: `wamid.mock.${crypto.randomUUID()}`,
    direction: "outbound",
    msg_type: msgType,
    body: input.body,
    media_url: null,
    media_mime_type: null,
    template_name: input.template_name ?? null,
    status: "sent",
    error_reason: null,
    created_at: timestamp,
  });

  const wasUnanswered = conversation.needs_reply;
  conversation.last_message_at = timestamp;
  conversation.last_message_preview = msgType === "audio" ? "Nota de voz" : input.body.slice(0, 120);
  conversation.last_message_media_type = msgType;
  conversation.needs_reply = false;
  conversation.unread_count = 0;

  if (wasUnanswered) {
    const delta = deltaOf(next, conversation.tenant_id);
    delta.unanswered -= 1;
  }
  const contact = next.data.contacts.find((c) => c.id === conversation.contact_id);
  if (contact) {
    contact.last_interaction_at = timestamp;
    contact.updated_at = timestamp;
  }
  return next;
}

/** Simula la llegada de un mensaje entrante (demo de badge "Sin responder"). */
export function receiveInboundMessage(state: CrmState, conversationId: string, body: string, msgType: MessageType = "text"): CrmState {
  const next = cloneState(state);
  const conversation = next.data.conversations.find((cv) => cv.id === conversationId);
  if (!conversation) return state;
  const timestamp = nowIso();

  next.data.messages.push({
    id: newId("ms"),
    tenant_id: conversation.tenant_id,
    conversation_id: conversationId,
    sender_member_id: null,
    wa_message_id: `wamid.mock.${crypto.randomUUID()}`,
    direction: "inbound",
    msg_type: msgType,
    body,
    media_url: null,
    media_mime_type: null,
    template_name: null,
    status: "read",
    error_reason: null,
    created_at: timestamp,
  });

  if (!conversation.needs_reply) {
    const delta = deltaOf(next, conversation.tenant_id);
    delta.unanswered += 1;
  }
  conversation.last_inbound_at = timestamp;
  conversation.last_message_at = timestamp;
  conversation.last_message_preview = msgType === "audio" ? "Nota de voz" : body.slice(0, 120);
  conversation.last_message_media_type = msgType;
  conversation.needs_reply = true;
  conversation.unread_count += 1;
  return next;
}

export function assignConversation(state: CrmState, conversationId: string, memberId: string | null): CrmState {
  const next = cloneState(state);
  const conversation = next.data.conversations.find((cv) => cv.id === conversationId);
  if (!conversation) return state;
  conversation.assigned_member_id = memberId;
  const contact = next.data.contacts.find((c) => c.id === conversation.contact_id);
  if (contact) contact.assigned_member_id = memberId;
  return next;
}

export function deleteConversation(state: CrmState, conversationId: string): CrmState {
  const next = cloneState(state);
  const conversation = next.data.conversations.find((cv) => cv.id === conversationId);
  if (!conversation) return state;
  if (conversation.needs_reply) {
    const delta = deltaOf(next, conversation.tenant_id);
    delta.unanswered -= 1;
  }
  next.data.conversations = next.data.conversations.filter((cv) => cv.id !== conversationId);
  next.data.messages = next.data.messages.filter((m) => m.conversation_id !== conversationId);
  return next;
}

/**
 * Abre (crea si no existe) la conversación omnicanal de un contacto.
 * El `conversationId` lo genera el store para poder devolverlo a la UI.
 */
export function createConversation(
  state: CrmState,
  tenantId: string,
  conversationId: string,
  contactId: string,
  memberId: string | null,
): CrmState {
  const next = cloneState(state);
  const timestamp = nowIso();
  next.data.conversations.unshift({
    id: conversationId,
    tenant_id: tenantId,
    contact_id: contactId,
    assigned_member_id: memberId,
    channel: "whatsapp",
    handler_mode: "human",
    unread_count: 0,
    needs_reply: false,
    last_inbound_at: null,
    last_message_at: timestamp,
    last_message_preview: null,
    last_message_media_type: "text",
    created_at: timestamp,
  });
  addActivity(next.data, tenantId, contactId, memberId, "conversation", "Se abrió la conversación de WhatsApp desde la ficha del contacto.");
  return next;
}

/** Registra una actividad/comentario manual en el historial de la ficha 360°. */
export function addContactActivity(
  state: CrmState,
  tenantId: string,
  contactId: string,
  actorMemberId: string | null,
  activityType: string,
  description: string,
  metadata: Record<string, string> = {},
): CrmState {
  const next = cloneState(state);
  addActivity(next.data, tenantId, contactId, actorMemberId, activityType, description.trim(), metadata);
  return next;
}

/* ============================================================================
 * NOTAS Y TAREAS (FICHA 360°)
 * ========================================================================== */

export function addContactNote(state: CrmState, tenantId: string, contactId: string, authorMemberId: string | null, content: string): CrmState {
  const next = cloneState(state);
  next.data.contactNotes.unshift({
    id: newId("n"),
    tenant_id: tenantId,
    contact_id: contactId,
    author_member_id: authorMemberId,
    content: content.trim(),
    created_at: nowIso(),
  });
  addActivity(next.data, tenantId, contactId, authorMemberId, "note", "Se registró una nota interna.");
  return next;
}

export function addContactTask(state: CrmState, tenantId: string, contactId: string, assignedMemberId: string | null, title: string, dueAt: string | null): CrmState {
  const next = cloneState(state);
  next.data.contactTasks.unshift({
    id: newId("t"),
    tenant_id: tenantId,
    contact_id: contactId,
    assigned_member_id: assignedMemberId,
    title: title.trim(),
    due_at: dueAt,
    is_completed: false,
    created_at: nowIso(),
  });
  addActivity(next.data, tenantId, contactId, assignedMemberId, "task", `Tarea creada: ${title.trim()}.`);
  return next;
}

export function toggleContactTask(state: CrmState, taskId: string): CrmState {
  const next = cloneState(state);
  const task = next.data.contactTasks.find((t) => t.id === taskId);
  if (!task) return state;
  task.is_completed = !task.is_completed;
  return next;
}

/* ============================================================================
 * PLANTILLAS DE WHATSAPP
 * ========================================================================== */

export interface CreateWhatsappTemplateInput {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  body_text: string;
  footer_text?: string | null;
  variables_count: number;
  /** Aditivos (M7): header y botones de la plantilla. */
  header_type?: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT";
  header_content?: string | null;
  buttons?: WhatsAppTemplateButton[];
}

export function createWhatsappTemplate(
  state: CrmState,
  tenantId: string,
  input: CreateWhatsappTemplateInput,
): CrmState {
  const next = cloneState(state);
  const timestamp = nowIso();
  next.data.whatsappTemplates.unshift({
    id: newId("wt"),
    tenant_id: tenantId,
    meta_template_id: null,
    name: input.name.trim(),
    category: input.category,
    language: input.language,
    header_type: input.header_type ?? "NONE",
    header_content: input.header_content?.trim() || null,
    body_text: input.body_text,
    footer_text: input.footer_text?.trim() || null,
    buttons: input.buttons ?? [],
    variables_count: input.variables_count,
    status: "PENDING",
    rejection_reason: "NONE",
    created_at: timestamp,
    updated_at: timestamp,
  });
  return next;
}

export function deleteWhatsappTemplate(state: CrmState, templateId: string): CrmState {
  const next = cloneState(state);
  next.data.whatsappTemplates = next.data.whatsappTemplates.filter((t) => t.id !== templateId);
  return next;
}

/* ============================================================================
 * WORKFLOWS
 * ========================================================================== */

export function createWorkflow(
  state: CrmState,
  tenantId: string,
  input: { name: string; description?: string | null; trigger_type: WorkflowTriggerType },
): CrmState {
  const next = cloneState(state);
  const timestamp = nowIso();
  next.data.workflows.unshift({
    id: newId("wf"),
    tenant_id: tenantId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: "Draft",
    trigger_type: input.trigger_type,
    allow_reenrollment: false,
    // QA-001: siembra el nodo disparador; un workflow nuevo ya no nace vacío.
    canvas_definition: seedTriggerCanvas(input.trigger_type, newId("n")),
    enrolled_count: 0,
    active_count: 0,
    updated_at: timestamp,
    created_at: timestamp,
  });
  return next;
}

export function toggleWorkflowStatus(state: CrmState, workflowId: string): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId);
  if (!workflow) return state;
  workflow.status = workflow.status === "Published" ? "Draft" : "Published";
  workflow.updated_at = nowIso();
  return next;
}

export function deleteWorkflow(state: CrmState, workflowId: string): CrmState {
  const next = cloneState(state);
  next.data.workflows = next.data.workflows.filter((w) => w.id !== workflowId);
  return next;
}

/* ----------------------------------------------------------------------------
 * M6 — Ajustes del flujo, edición del lienzo e inscripción con simulación
 * -------------------------------------------------------------------------- */

export interface UpdateWorkflowInput {
  name?: string;
  description?: string | null;
  allow_reenrollment?: boolean;
}

export function updateWorkflow(state: CrmState, workflowId: string, input: UpdateWorkflowInput): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId);
  if (!workflow) return state;
  if (input.name !== undefined) workflow.name = input.name.trim();
  if (input.description !== undefined) workflow.description = input.description?.trim() || null;
  if (input.allow_reenrollment !== undefined) workflow.allow_reenrollment = input.allow_reenrollment;
  workflow.updated_at = nowIso();
  return next;
}

export function updateWorkflowNodeConfig(
  state: CrmState,
  workflowId: string,
  nodeId: string,
  config: Record<string, string>,
): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId);
  const node = workflow?.canvas_definition.nodes.find((n) => n.id === nodeId);
  if (!workflow || !node) return state;
  node.config = { ...node.config, ...config };
  workflow.updated_at = nowIso();
  return next;
}

export interface AddWorkflowActionNodeInput {
  label: string;
  config: Record<string, string>;
  /** Etiqueta de la rama cuando se inserta bajo un nodo condicional. */
  edgeLabel?: string | null;
}

/**
 * Inserta un nodo de acción después del nodo origen. Si el origen ya tenía un
 * enlace saliente con la misma etiqueta, el nuevo paso se empotra en la cadena
 * (origen → nuevo → destino anterior) para no perder el resto del flujo.
 */
export function addWorkflowActionNode(
  state: CrmState,
  workflowId: string,
  sourceNodeId: string,
  input: AddWorkflowActionNodeInput,
): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId);
  const source = workflow?.canvas_definition.nodes.find((n) => n.id === sourceNodeId);
  if (!workflow || !source) return state;
  const canvas = workflow.canvas_definition;
  const nodeId = newId("n");
  canvas.nodes.push({
    id: nodeId,
    type: "action",
    label: input.label.trim(),
    config: input.config,
    position: { x: source.position.x, y: source.position.y + 150 },
  });
  const edgeLabel = input.edgeLabel ?? null;
  const existing = canvas.edges.find((e) => e.source_node_id === sourceNodeId && e.label === edgeLabel);
  if (existing) {
    canvas.edges = canvas.edges.filter((e) => e.id !== existing.id);
    canvas.edges.push({ id: newId("e"), source_node_id: sourceNodeId, target_node_id: nodeId, label: existing.label });
    canvas.edges.push({ id: newId("e"), source_node_id: nodeId, target_node_id: existing.target_node_id, label: null });
  } else {
    canvas.edges.push({ id: newId("e"), source_node_id: sourceNodeId, target_node_id: nodeId, label: edgeLabel });
  }
  workflow.updated_at = nowIso();
  return next;
}

export interface AddWorkflowInitialNodeInput {
  label: string;
  config: Record<string, string>;
  type?: "trigger" | "action";
}

/**
 * Crea el primer nodo de un workflow cuyo lienzo está vacío (QA-001), sin
 * exigir un `sourceNodeId` previo. Si el lienzo ya tiene nodos, no hace nada
 * (la inserción normal debe usar `addWorkflowActionNode`).
 */
export function addWorkflowInitialNode(
  state: CrmState,
  workflowId: string,
  input: AddWorkflowInitialNodeInput,
): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId);
  if (!workflow) return state;
  const canvas = workflow.canvas_definition;
  if (canvas.nodes.length > 0) return state;
  canvas.nodes.push({
    id: newId("n"),
    type: input.type ?? "trigger",
    label: input.label.trim(),
    config: input.config,
    position: { x: 0, y: 0 },
  });
  workflow.updated_at = nowIso();
  return next;
}

export type SimulatedReply = "Si" | "No" | "Otra respuesta" | "Undelivered" | "Time Out";

/**
 * Inscribe un contacto en el workflow y ejecuta su lienzo paso a paso:
 * dispara las acciones configuradas (plantilla, seguimiento, etapa y reparto
 * Round Robin) y deja la trazabilidad completa en los logs de ejecución.
 * Idempotente: respeta `allow_reenrollment` (una sola inscripción).
 */
export function enrollContactInWorkflow(
  state: CrmState,
  tenantId: string,
  workflowId: string,
  contactId: string,
  simulatedReply: SimulatedReply | null,
): CrmState {
  const next = cloneState(state);
  const workflow = next.data.workflows.find((w) => w.id === workflowId && w.tenant_id === tenantId);
  const contact = next.data.contacts.find((c) => c.id === contactId && c.tenant_id === tenantId);
  if (!workflow || !contact) return state;
  const alreadyEnrolled = next.data.workflowEnrollments.some(
    (e) => e.workflow_id === workflowId && e.contact_id === contactId,
  );
  if (alreadyEnrolled && !workflow.allow_reenrollment) return state;

  const timestamp = nowIso();
  const canvas = workflow.canvas_definition;
  const delta = deltaOf(next, tenantId);
  const logs: WorkflowExecutionLogEntry[] = [];
  let status: WorkflowEnrollment["status"] = "completed";
  let waitExpiresAt: string | null = null;
  let currentNodeId: string | null = null;
  let failed = false;

  const pushLog = (nodeId: string, nodeLabel: string, outcome: WorkflowExecutionLogEntry["outcome"], detail: string) => {
    logs.push({ node_id: nodeId, node_label: nodeLabel, executed_at: nowIso(), outcome, detail });
  };
  const nodeById = (nodeId: string) => canvas.nodes.find((n) => n.id === nodeId) ?? null;

  const createOpportunityAtStage = (stage: PipelineStage): void => {
    next.data.opportunities.unshift({
      id: newId("o"),
      tenant_id: tenantId,
      contact_id: contact.id,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      assigned_member_id: contact.assigned_member_id,
      title: "Plan 50GB + llamadas ilimitadas",
      monetary_value: 38000,
      status: "open",
      closed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
    if (stage.stage_category === "open") {
      delta.openOpportunities += 1;
      delta.stageCounts[stage.id] = (delta.stageCounts[stage.id] ?? 0) + 1;
    }
  };

  const moveOpenOpportunityToStage = (stage: PipelineStage): boolean => {
    const open = next.data.opportunities.find(
      (o) => o.contact_id === contact.id && o.pipeline_id === stage.pipeline_id && o.status === "open",
    );
    if (!open) return false;
    delta.stageCounts[open.stage_id] = (delta.stageCounts[open.stage_id] ?? 0) - 1;
    if (stage.stage_category === "open") {
      delta.stageCounts[stage.id] = (delta.stageCounts[stage.id] ?? 0) + 1;
    } else {
      delta.openOpportunities -= 1;
      if (stage.stage_category === "won") monthlyOf(delta)[currentMonthKey()]!.ganadas += 1;
      if (stage.stage_category === "lost") monthlyOf(delta)[currentMonthKey()]!.perdidas += 1;
    }
    open.stage_id = stage.id;
    open.status = stage.stage_category;
    open.closed_at = stage.stage_category === "open" ? null : timestamp;
    open.updated_at = timestamp;
    return true;
  };

  let node = canvas.nodes.find((n) => n.type === "trigger") ?? canvas.nodes[0] ?? null;
  let safety = 0;
  while (node && !failed && safety < 25) {
    safety += 1;
    currentNodeId = node.id;
    const label = node.label;

    if (node.type === "trigger") {
      pushLog(node.id, label, "success", `${label}: inscripción iniciada.`);
    } else if (node.type === "branch") {
      if (!simulatedReply) {
        pushLog(node.id, label, "skipped", `${label}: esperando respuesta del contacto (Time Out: 24 h).`);
        status = "waiting_reply";
        waitExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        break;
      }
      const branchSourceId = node.id;
      const branchEdge = canvas.edges.find((e) => e.source_node_id === branchSourceId && e.label === simulatedReply);
      pushLog(node.id, label, "success", `Respuesta recibida: "${simulatedReply}".`);
      node = branchEdge ? nodeById(branchEdge.target_node_id) : null;
      continue;
    } else if (label.startsWith("Enviar WhatsApp")) {
      const templateName = node.config.template ?? "sin plantilla";
      let conversation = next.data.conversations.find((cv) => cv.contact_id === contact.id);
      if (!conversation) {
        conversation = {
          id: newId("cv"),
          tenant_id: tenantId,
          contact_id: contact.id,
          assigned_member_id: contact.assigned_member_id,
          channel: "whatsapp",
          handler_mode: "human",
          unread_count: 0,
          needs_reply: false,
          last_inbound_at: null,
          last_message_at: timestamp,
          last_message_preview: null,
          last_message_media_type: "text",
          created_at: timestamp,
        };
        next.data.conversations.unshift(conversation);
      }
      next.data.messages.push({
        id: newId("ms"),
        tenant_id: tenantId,
        conversation_id: conversation.id,
        sender_member_id: null,
        wa_message_id: `wamid.mock.${crypto.randomUUID()}`,
        direction: "outbound",
        msg_type: "template",
        body: `[Plantilla ${templateName}] mensaje automático del workflow «${workflow.name}».`,
        media_url: null,
        media_mime_type: null,
        template_name: templateName,
        status: "sent",
        error_reason: null,
        created_at: timestamp,
      });
      conversation.last_message_at = timestamp;
      conversation.last_message_preview = `Plantilla ${templateName}`;
      conversation.last_message_media_type = "template";
      pushLog(node.id, label, "success", `Plantilla "${templateName}" enviada por WhatsApp.`);
    } else if (label.startsWith("Marcar en seguimiento")) {
      contact.is_starred = true;
      pushLog(node.id, label, "success", "Contacto marcado con ⭐ seguimiento.");
    } else if (label.startsWith("Mover a") || label.startsWith("Crear oportunidad")) {
      const stageId = node.config.stage_id ?? "";
      const stage = next.data.pipelineStages.find((s) => s.id === stageId && s.tenant_id === tenantId);
      if (!stage) {
        pushLog(node.id, label, "error", `Etapa no encontrada (stage_id: ${stageId || "vacío"}).`);
        failed = true;
        break;
      }
      const moved = label.startsWith("Mover a") && moveOpenOpportunityToStage(stage);
      if (!moved && label.startsWith("Crear oportunidad")) {
        const hasOpen = next.data.opportunities.some(
          (o) => o.contact_id === contact.id && o.pipeline_id === stage.pipeline_id && o.status === "open",
        );
        if (hasOpen) {
          pushLog(node.id, label, "skipped", `El contacto ya tiene una oportunidad abierta en «${stage.name}».`);
        } else {
          createOpportunityAtStage(stage);
          pushLog(node.id, label, "success", `Oportunidad creada en la etapa «${stage.name}».`);
        }
      } else if (!moved) {
        createOpportunityAtStage(stage);
        pushLog(node.id, label, "success", `Sin oportunidad abierta: creada directamente en «${stage.name}».`);
      } else {
        pushLog(node.id, label, "success", `Oportunidad movida a la etapa «${stage.name}».`);
      }
      if (stage.stage_category === "lost") contact.typification = "Cliente perdido";
    } else if (label.startsWith("Asignar a un miembro")) {
      const candidates = next.data.tenantMembers.filter(
        (m) => m.tenant_id === tenantId && m.is_active && m.role === "agent",
      );
      if (candidates.length === 0) {
        pushLog(node.id, label, "error", "No hay agentes activos disponibles para el reparto Round Robin.");
        failed = true;
        break;
      }
      const pick = candidates.reduce((oldest, member) => {
        const oldestKey = oldest.last_assigned_at ?? "";
        const memberKey = member.last_assigned_at ?? "";
        return memberKey < oldestKey ? member : oldest;
      });
      pick.last_assigned_at = timestamp;
      contact.assigned_member_id = pick.id;
      const conversation = next.data.conversations.find((cv) => cv.contact_id === contact.id);
      if (conversation) conversation.assigned_member_id = pick.id;
      for (const opp of next.data.opportunities) {
        if (opp.contact_id === contact.id && opp.status === "open") opp.assigned_member_id = pick.id;
      }
      pushLog(node.id, label, "success", `Reparto Round Robin → ${pick.email}.`);
    } else {
      pushLog(node.id, label, "skipped", `Acción «${label}» registrada sin efectos en la simulación.`);
    }

    const linearSourceId = node.id;
    const nextEdge = canvas.edges.find((e) => e.source_node_id === linearSourceId && e.label === null);
    node = nextEdge ? nodeById(nextEdge.target_node_id) : null;
  }

  contact.last_interaction_at = timestamp;
  contact.updated_at = timestamp;
  next.data.workflowEnrollments.unshift({
    id: newId("we"),
    tenant_id: tenantId,
    workflow_id: workflowId,
    contact_id: contactId,
    current_node_id: currentNodeId,
    status,
    wait_expires_at: waitExpiresAt,
    execution_logs: logs,
    enrolled_at: timestamp,
    completed_at: status === "completed" ? timestamp : null,
  });
  workflow.enrolled_count += 1;
  workflow.active_count = next.data.workflowEnrollments.filter(
    (e) => e.workflow_id === workflowId && e.status !== "completed",
  ).length;
  workflow.updated_at = timestamp;
  addActivity(next.data, tenantId, contactId, null, "workflow", `Workflow «${workflow.name}» ejecutado (${status === "completed" ? "completado" : "en espera de respuesta"}).`);
  return next;
}


/* ============================================================================
 * EQUIPO (TENANT MEMBERS)
 * ========================================================================== */

export function inviteMember(state: CrmState, tenantId: string, email: string, role: UserRole): CrmState {
  const next = cloneState(state);
  next.data.tenantMembers.push({
    id: newId("m"),
    tenant_id: tenantId,
    user_id: null,
    email: email.trim().toLowerCase(),
    role,
    is_active: true,
    can_view_all_contacts: role !== "agent",
    presence: "offline",
    last_assigned_at: null,
    created_at: nowIso(),
  });
  return next;
}

export function updateMember(state: CrmState, memberId: string, patch: Partial<Pick<import("@/shared/types/database").TenantMember, "is_active" | "can_view_all_contacts" | "presence">>): CrmState {
  const next = cloneState(state);
  const member = next.data.tenantMembers.find((m) => m.id === memberId);
  if (!member) return state;
  Object.assign(member, patch);
  return next;
}

export function deleteMember(state: CrmState, memberId: string): CrmState {
  const next = cloneState(state);
  next.data.tenantMembers = next.data.tenantMembers.filter((m) => m.id !== memberId);
  next.data.contacts = next.data.contacts.map((c) => (c.assigned_member_id === memberId ? { ...c, assigned_member_id: null } : c));
  next.data.conversations = next.data.conversations.map((cv) => (cv.assigned_member_id === memberId ? { ...cv, assigned_member_id: null } : cv));
  next.data.opportunities = next.data.opportunities.map((o) => (o.assigned_member_id === memberId ? { ...o, assigned_member_id: null } : o));
  return next;
}

/* ============================================================================
 * BOTS IA
 * ========================================================================== */

export function createAiBot(state: CrmState, tenantId: string, input: { name: string; product_line: string; provider: AiBotProvider; system_prompt: string; model_name?: string | null; fallback_models?: string[]; priority?: number; bot_role?: "greeter" | "pricing" | "faq" | "custom"; trigger_keywords?: string[] }): CrmState {
  const next = cloneState(state);
  next.data.aiBots.unshift({
    id: newId("bot"),
    tenant_id: tenantId,
    name: input.name.trim(),
    product_line: input.product_line.trim(),
    provider: input.provider,
    system_prompt: input.system_prompt,
    model_name: input.model_name?.trim() || null,
    fallback_models: input.fallback_models ?? [],
    priority: input.priority ?? 10,
    bot_role: input.bot_role ?? "custom",
    trigger_keywords: input.trigger_keywords ?? [],
    is_active: true,
    created_at: nowIso(),
  });
  return next;
}

export function toggleAiBot(state: CrmState, botId: string): CrmState {
  const next = cloneState(state);
  const bot = next.data.aiBots.find((b) => b.id === botId);
  if (!bot) return state;
  bot.is_active = !bot.is_active;
  return next;
}

// QA-004: elimina un bot IA de la lista local (el borrado real lo hace el store vía RLS).
export function deleteAiBot(state: CrmState, botId: string): CrmState {
  const next = cloneState(state);
  next.data.aiBots = next.data.aiBots.filter((b) => b.id !== botId);
  return next;
}

// Edición de bots: ajusta nombre, línea de negocio e instrucciones sin recrear el bot.
export type UpdateAiBotPatch = Partial<Pick<AiBot, "name" | "product_line" | "provider" | "system_prompt" | "is_active" | "model_name" | "fallback_models" | "priority" | "bot_role" | "trigger_keywords">>;

export function updateAiBot(state: CrmState, botId: string, patch: UpdateAiBotPatch): CrmState {
  const next = cloneState(state);
  const bot = next.data.aiBots.find((b) => b.id === botId);
  if (!bot) return state;
  Object.assign(bot, patch);
  return next;
}

/* ============================================================================
 * INTEGRACIONES (BÓVEDA)
 * ========================================================================== */

export function setIntegrationConnected(state: CrmState, tenantId: string, provider: IntegrationProvider, connected: boolean): CrmState {
  const next = cloneState(state);
  const integration = next.data.integrationsVault.find((i) => i.tenant_id === tenantId && i.provider === provider);
  if (integration) {
    integration.is_connected = connected;
    integration.updated_at = nowIso();
  } else {
    next.data.integrationsVault.push({
      id: newId("iv"),
      tenant_id: tenantId,
      provider,
      is_connected: connected,
      public_metadata: {},
      encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
      updated_at: nowIso(),
    });
  }
  return next;
}

/* ============================================================================
 * CAMPOS Y VALORES PERSONALIZADOS
 * ========================================================================== */

export function addCustomField(state: CrmState, tenantId: string, input: { field_key: string; field_label: string; field_type: CustomFieldType; options?: string[] }): CrmState {
  const next = cloneState(state);
  next.data.customFieldDefinitions.push({
    id: newId("cf"),
    tenant_id: tenantId,
    field_key: input.field_key.trim(),
    field_label: input.field_label.trim(),
    field_type: input.field_type,
    options: input.options ?? [],
    created_at: nowIso(),
  });
  return next;
}

export function deleteCustomField(state: CrmState, fieldId: string): CrmState {
  const next = cloneState(state);
  next.data.customFieldDefinitions = next.data.customFieldDefinitions.filter((f) => f.id !== fieldId);
  return next;
}

export function addCustomValue(state: CrmState, tenantId: string, valueKey: string, valueContent: string): CrmState {
  const next = cloneState(state);
  next.data.customValues.push({
    id: newId("cvv"),
    tenant_id: tenantId,
    value_key: valueKey.trim(),
    value_content: valueContent.trim(),
    created_at: nowIso(),
  });
  return next;
}

export function deleteCustomValue(state: CrmState, valueId: string): CrmState {
  const next = cloneState(state);
  next.data.customValues = next.data.customValues.filter((v) => v.id !== valueId);
  return next;
}
