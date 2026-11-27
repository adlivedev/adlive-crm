/**
 * TIPOS MAESTROS DE BASE DE DATOS — ADlive CRM
 *
 * Interfaces idénticas, tabla por tabla, al esquema SQL definido en
 * `context/02-base-de-datos-supabase.md`. Cero `any`: cualquier adaptador
 * (Mock en Etapa A o Supabase MCP en Etapa B) debe satisfacer estos contratos.
 *
 * Enums reflejados como uniones literales de TypeScript.
 */

/* ============================================================================
 * ENUMS (CREATE TYPE ... AS ENUM)
 * ========================================================================== */

export type UserRole = "owner" | "admin" | "agent";

export type AgentPresence = "online" | "offline" | "busy";

export type StageType = "open" | "won" | "lost";

export type ConversationHandler = "bot" | "human";

export type MessageDirection = "inbound" | "outbound";

export type MessageType =
  | "text"
  | "template"
  | "image"
  | "interactive"
  | "audio"
  | "video"
  | "document"
  | "system";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

/* ============================================================================
 * 1. MULTI-TENANCY (AGENCIAS / CUENTAS) Y EQUIPO (CALL CENTER)
 * ========================================================================== */

export interface TenantBranding {
  brand_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  primary_color: string;
  primary_hover: string;
  accent_color: string;
  sidebar_bg: string;
  canvas_bg: string;
  ink_color: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  public_webhook_token: string;
  branding?: TenantBranding;
  status?: "active" | "suspended";
  default_new_contact_mode?: "bot" | "human";
  default_bot_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  can_view_all_contacts: boolean;
  presence: AgentPresence;
  last_assigned_at: string | null;
  created_at: string;
}

/* ============================================================================
 * 2. CONTACTOS, CAMPOS PERSONALIZADOS Y ATRIBUCIÓN UTM
 * ========================================================================== */

export type CustomFieldType = "text" | "textarea" | "name" | "phone" | "email" | "number" | "select" | "checkbox" | "radio" | "date" | "html";

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  field_key: string;
  field_label: string;
  field_type: CustomFieldType;
  options: string[];
  created_at: string;
}

export interface CustomValue {
  id: string;
  tenant_id: string;
  value_key: string;
  value_content: string;
  created_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  assigned_member_id: string | null;
  full_name: string;
  phone_e164: string;
  email: string | null;
  company_name: string | null;
  lead_source: string;
  tags: string[];
  custom_fields: Record<string, string>;
  is_closed_client: boolean;
  is_starred: boolean;
  typification: string | null;
  opt_out_marketing: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  landing_url: string | null;
  referrer_url: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================================================================
 * 3. PIPELINES Y OPORTUNIDADES (TABLERO KANBAN)
 * ========================================================================== */

export interface Pipeline {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  tenant_id: string;
  name: string;
  position: number;
  stage_category: StageType;
  created_at: string;
}

export interface Opportunity {
  id: string;
  tenant_id: string;
  contact_id: string;
  pipeline_id: string;
  stage_id: string;
  assigned_member_id: string | null;
  title: string;
  monetary_value: number;
  status: StageType;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================================================================
 * 4. CONVERSACIONES OMNICANAL, REGLA 24H META Y MENSAJES
 * ========================================================================== */

export interface Conversation {
  id: string;
  tenant_id: string;
  contact_id: string;
  assigned_member_id: string | null;
  channel: string;
  handler_mode: ConversationHandler;
  unread_count: number;
  needs_reply: boolean;
  last_inbound_at: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_media_type: MessageType;
  /** Teléfono de destino alternativo elegido en el chat (contact_phones). */
  target_phone_e164?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  sender_member_id: string | null;
  wa_message_id: string | null;
  /** Presente en respuestas vinculadas; opcional para compatibilidad con proyecciones antiguas. */
  in_reply_to_message_id?: string | null;
  direction: MessageDirection;
  msg_type: MessageType;
  body: string | null;
  media_url: string | null;
  /** Identificador de multimedia de Meta; se descarga bajo demanda vía /api/v1/messages/[id]/media. */
  media_id?: string | null;
  media_mime_type: string | null;
  /** Moderación: fecha en que se eliminó el archivo del Storage. */
  media_deleted_at?: string | null;
  /** Transcripción y resumen automático de audios (Gemini/Whisper). */
  audio_transcript?: string | null;
  audio_summary?: string | null;
  audio_moderation_flag?: boolean;
  template_name: string | null;
  status: MessageStatus;
  error_reason: string | null;
  created_at: string;
}

/* ============================================================================
 * 5. FICHA 360: NOTAS, TAREAS, CITAS, DOCUMENTOS E HISTORIAL
 * ========================================================================== */

export interface ContactNote {
  id: string;
  tenant_id: string;
  contact_id: string;
  author_member_id: string | null;
  content: string;
  created_at: string;
}

export interface ContactTask {
  id: string;
  tenant_id: string;
  contact_id: string;
  assigned_member_id: string | null;
  title: string;
  due_at: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface ContactActivity {
  id: string;
  tenant_id: string;
  contact_id: string;
  actor_member_id: string | null;
  activity_type: string;
  description: string;
  metadata: Record<string, string>;
  created_at: string;
}

/* ============================================================================
 * 5b. CAMPAÑAS MASIVAS DE WHATSAPP
 * ========================================================================== */

export type CampaignMessageType = "template" | "text" | "interactive";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

/** Filtros de audiencia de una campaña masiva (vacío = todos los contactos). */
export interface CampaignFilters {
  utm_source?: string | null;
  utm_campaign?: string | null;
  created_from?: string | null; // ISO date YYYY-MM-DD
  created_to?: string | null;   // ISO date YYYY-MM-DD
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  msg_type: CampaignMessageType;
  template_name: string | null;
  body: string;
  interactive: CampaignInteractive | null;
  filters: CampaignFilters;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

/** Mensaje interactivo de campaña: cuerpo + botones de respuesta o CTA con enlace. */
export interface CampaignInteractive {
  body: string;
  footer?: string;
  buttons: Array<{ kind: "reply" | "cta_url"; title: string; url?: string }>;
}

export type CampaignSendStatus = "sent" | "failed" | "skipped";

export interface CampaignSend {
  id: string;
  tenant_id: string;
  campaign_id: string;
  contact_id: string;
  status: CampaignSendStatus;
  error: string | null;
  sent_at: string;
}

/* ============================================================================
 * 6. PLANTILLAS DE WHATSAPP (META CLOUD API)
 * ========================================================================== */

export type WhatsAppTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type WhatsAppTemplateStatus =
  | "APPROVED" | "DISABLED" | "REJECTED" | "PENDING"
  | "PAUSED" | "FLAGGED" | "ARCHIVED" | "DELETED"
  | "PENDING_DELETION" | "IN_APPEAL" | "LOCKED" | "LIMIT_EXCEEDED";

export interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  meta_template_id: string | null;
  name: string;
  category: WhatsAppTemplateCategory;
  language: string;
  header_type: string | null;
  header_content: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: WhatsAppTemplateButton[];
  variables_count: number;
  status: WhatsAppTemplateStatus;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

/* ============================================================================
 * 7. AUTOMATIZACIONES (WORKFLOWS VISUALES) Y BOTS IA
 * ========================================================================== */

export type WorkflowStatus = "Draft" | "Published";

export type WorkflowTriggerType =
  | "manual_enrollment"
  | "contact_created"
  | "channel_message_received"
  | "sla_no_response";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "branch";
  label: string;
  config: Record<string, string>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
}

export interface WorkflowCanvasDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_type: WorkflowTriggerType;
  allow_reenrollment: boolean;
  canvas_definition: WorkflowCanvasDefinition;
  enrolled_count: number;
  active_count: number;
  updated_at: string;
  created_at: string;
}

export interface WorkflowEnrollment {
  id: string;
  tenant_id: string;
  workflow_id: string;
  contact_id: string;
  current_node_id: string | null;
  status: string;
  wait_expires_at: string | null;
  execution_logs: WorkflowExecutionLogEntry[];
  enrolled_at: string;
  completed_at: string | null;
}

export interface WorkflowExecutionLogEntry {
  node_id: string;
  node_label: string;
  executed_at: string;
  outcome: "success" | "error" | "skipped";
  detail: string;
}

export type AiBotProvider = "integrated" | "openai" | "anthropic" | "grok" | "gemini";

export interface AiBot {
  id: string;
  tenant_id: string;
  name: string;
  product_line: string;
  provider: AiBotProvider;
  system_prompt: string;
  model_name: string | null;
  fallback_models: string[];
  priority: number;
  bot_role: "greeter" | "pricing" | "faq" | "custom";
  trigger_keywords: string[];
  is_active: boolean;
  created_at: string;
}

export interface AiUsageLog {
  id: string;
  tenant_id: string;
  bot_id: string | null;
  provider: string;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  status: string;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
}

/* ============================================================================
 * 8. BÓVEDA DE CREDENCIALES EN SERVIDOR (INTEGRACIONES Y API KEYS IA)
 * ========================================================================== */

export type IntegrationProvider =
  | "whatsapp_cloud_api"
  | "facebook_lead_ads"
  | "instagram"
  | "tiktok_ads"
  | "twilio"
  | "telnyx";

export interface TenantIntegrationVault {
  id: string;
  tenant_id: string;
  provider: IntegrationProvider;
  is_connected: boolean;
  public_metadata: Record<string, string>;
  /** Solo existe en consultas de servidor; las APIs públicas nunca lo devuelven. */
  encrypted_credentials?: string;
  masked_key?: string | null;
  /** Solo se devuelve a owner/admin para configurar el webhook de Meta. */
  verify_token?: string | null;
  updated_at: string;
}

/* ============================================================================
 * TIPOS COMPUESTOS DE PRESENTACIÓN (solo lectura, derivados en servicios)
 * ========================================================================== */

/** Oportunidad con datos del contacto y de la etapa resueltos para la UI. */
export interface OpportunityWithDetails extends Opportunity {
  contact_name: string;
  contact_phone: string;
  contact_tags: string[];
  stage_name: string;
  stage_category: StageType;
  assigned_member_name: string | null;
}

/** Conversación con datos del contacto y del asesor resueltos para la UI. */
export interface ConversationWithDetails extends Conversation {
  contact_name: string;
  contact_phone: string;
  contact_tags: string[];
  assigned_member_name: string | null;
  assigned_member_email: string | null;
}

/** Fila de la tabla de Atribución (M11): métricas agregadas por dimensión UTM. */
export interface AttributionRow {
  dimension_id: string;
  dimension_name: string;
  leads: number;
  won: number;
  conversion_pct: number;
  won_value: number;
}
