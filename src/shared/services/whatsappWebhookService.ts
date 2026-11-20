import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import { processTemplateStatusChanges, templateStatusValueSchema } from "@/shared/services/whatsappTemplateWebhookService";
import type { TemplateStatusChange } from "@/shared/services/whatsappTemplateWebhookService";
import type { MessageType } from "@/shared/types/database";

const mediaSchema = z.object({
  id: z.string().min(1).max(300).optional(), caption: z.string().max(4096).optional(),
  mime_type: z.string().max(100).optional(), filename: z.string().max(255).optional(),
}).passthrough();
const referralSchema = z.object({
  source_type: z.string().max(100).optional(), source_id: z.string().max(255).optional(),
  source_url: z.string().url().max(2048).optional(), ctwa_clid: z.string().max(255).optional(),
  headline: z.string().max(255).optional(), body: z.string().max(1024).optional(),
}).passthrough();
const messageSchema = z.object({
  from: z.string().regex(/^\d{7,20}$/), id: z.string().min(1).max(150),
  timestamp: z.string().regex(/^\d{10}$/), type: z.string().min(1).max(40),
  text: z.object({ body: z.string().max(4096) }).optional(),
  image: mediaSchema.optional(), audio: mediaSchema.optional(), video: mediaSchema.optional(), document: mediaSchema.optional(),
  button: z.object({ text: z.string().max(1024) }).passthrough().optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string().max(1024) }).passthrough().optional(),
    list_reply: z.object({ title: z.string().max(1024) }).passthrough().optional(),
  }).passthrough().optional(),
  referral: referralSchema.optional(),
}).passthrough();
const valueSchema = z.object({
  messaging_product: z.literal("whatsapp").optional(),
  metadata: z.object({ phone_number_id: z.string().min(1).max(100) }).passthrough(),
  contacts: z.array(z.object({
    wa_id: z.string().regex(/^\d{7,20}$/),
    profile: z.object({ name: z.string().trim().max(200) }).passthrough().optional(),
  }).passthrough()).max(1000).optional(),
  messages: z.array(messageSchema).max(1000).optional(),
  statuses: z.array(z.object({
    id: z.string().min(1).max(150), status: z.enum(["sent", "delivered", "read", "failed"]),
    timestamp: z.string().regex(/^\d{10}$/), recipient_id: z.string().regex(/^\d{7,20}$/),
    errors: z.array(z.object({
      code: z.number().int().optional(), title: z.string().max(300).optional(), message: z.string().max(500).optional(),
      error_data: z.object({ details: z.string().max(500) }).passthrough().optional(),
    }).passthrough()).max(20).optional(),
  }).passthrough()).max(1000).optional(),
}).passthrough();

/** El sobre es flexible; cada campo soportado se valida por separado antes de escribir. */
export const whatsappPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string().regex(/^\d{1,100}$/).optional(),
    changes: z.array(z.object({ field: z.string().min(1).max(100), value: z.unknown() }).passthrough()).max(100),
  }).passthrough()).max(100),
}).passthrough();

export class WhatsAppChangeValidationError extends Error {
  constructor(field: string, entryIndex: number, changeIndex: number) {
    super(`Campo ${field} no válido en entry ${entryIndex}, change ${changeIndex}.`);
    this.name = "WhatsAppChangeValidationError";
  }
}
export class WhatsAppTenantMismatchError extends Error {
  constructor() { super("La línea de WhatsApp no pertenece al workspace de la ruta."); this.name = "WhatsAppTenantMismatchError"; }
}

export type WhatsAppPayload = z.infer<typeof whatsappPayloadSchema>;
type WhatsAppMessageValue = z.infer<typeof valueSchema>;
type WhatsAppMessage = z.infer<typeof messageSchema>;
type WhatsAppContact = NonNullable<WhatsAppMessageValue["contacts"]>[number];
type AdminClient = ReturnType<typeof createAdminClient>;

export interface WhatsAppIngestionScope { tenantId?: string; phoneNumberId?: string }
interface NormalizedMessage {
  wa_message_id: string; phone_e164: string; full_name: string; body: string;
  msg_type: MessageType; media_id: string | null; media_mime_type: string | null; occurred_at: string;
  lead_source: string | null; utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; utm_term: string | null; fbclid: string | null; landing_url: string | null;
}

function messageContent(message: WhatsAppMessage): Pick<NormalizedMessage, "body" | "msg_type" | "media_id" | "media_mime_type"> {
  const interactiveText = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
  if (message.type === "text") return { body: message.text?.body ?? "", msg_type: "text", media_id: null, media_mime_type: null };
  if (message.type === "button") return { body: message.button?.text ?? "[Respuesta de botón]", msg_type: "text", media_id: null, media_mime_type: null };
  if (message.type === "interactive") return { body: interactiveText ?? "[Respuesta interactiva]", msg_type: "text", media_id: null, media_mime_type: null };
  if (message.type === "image") return { body: message.image?.caption ?? "[Imagen recibida]", msg_type: "image", media_id: message.image?.id ?? null, media_mime_type: message.image?.mime_type ?? null };
  if (message.type === "audio") return { body: "[Nota de voz recibida]", msg_type: "audio", media_id: message.audio?.id ?? null, media_mime_type: message.audio?.mime_type ?? null };
  if (message.type === "video") return { body: message.video?.caption ?? "[Video recibido]", msg_type: "video", media_id: message.video?.id ?? null, media_mime_type: message.video?.mime_type ?? null };
  if (message.type === "document") return { body: message.document?.caption ?? message.document?.filename ?? "[Documento recibido]", msg_type: "document", media_id: message.document?.id ?? null, media_mime_type: message.document?.mime_type ?? null };
  return { body: `[Mensaje de WhatsApp no compatible: ${message.type}]`, msg_type: "system", media_id: null, media_mime_type: null };
}

function normalizeMessage(message: WhatsAppMessage, contacts: WhatsAppContact[]): NormalizedMessage {
  const profileName = contacts.find((contact) => contact.wa_id === message.from)?.profile?.name?.trim();
  const referral = message.referral;
  return {
    wa_message_id: message.id, phone_e164: `+${message.from}`, full_name: profileName || `WhatsApp +${message.from}`,
    occurred_at: new Date(Number(message.timestamp) * 1000).toISOString(), ...messageContent(message),
    lead_source: referral ? "Meta Ads" : null, utm_source: referral ? "meta" : null,
    utm_medium: referral ? "paid_social" : null, utm_campaign: referral?.headline ?? null,
    utm_term: referral?.source_id ?? null, fbclid: referral?.ctwa_clid ?? null, landing_url: referral?.source_url ?? null,
  };
}

function parseSupportedChanges(payload: WhatsAppPayload): {
  messageValues: WhatsAppMessageValue[]; templateChanges: TemplateStatusChange[]; ignoredFields: Record<string, number>;
} {
  const messageValues: WhatsAppMessageValue[] = [];
  const templateChanges: TemplateStatusChange[] = [];
  const ignoredFields: Record<string, number> = {};
  payload.entry.forEach((entry, entryIndex) => {
    entry.changes.forEach((change, changeIndex) => {
      if (change.field === "messages") {
        const parsed = valueSchema.safeParse(change.value);
        if (!parsed.success) throw new WhatsAppChangeValidationError(change.field, entryIndex, changeIndex);
        messageValues.push(parsed.data);
      } else if (change.field === "message_template_status_update") {
        const parsed = templateStatusValueSchema.safeParse(change.value);
        if (!parsed.success) throw new WhatsAppChangeValidationError(change.field, entryIndex, changeIndex);
        templateChanges.push({ wabaId: entry.id ?? null, value: parsed.data });
      } else ignoredFields[change.field] = (ignoredFields[change.field] ?? 0) + 1;
    });
  });
  return { messageValues, templateChanges, ignoredFields };
}

/** Valida todos los campos soportados antes de confirmar eventos diferidos. */
export function validateWhatsAppChanges(payload: WhatsAppPayload, scope: WhatsAppIngestionScope = {}) {
  const parsed = parseSupportedChanges(payload);
  if (scope.phoneNumberId && parsed.messageValues.some((value) => value.metadata.phone_number_id !== scope.phoneNumberId)) {
    throw new WhatsAppTenantMismatchError();
  }
  return parsed;
}

async function updateDeliveryStatuses(values: WhatsAppMessageValue[], admin: AdminClient, tenantId?: string): Promise<number> {
  let updated = 0;
  for (const value of values) {
    const statuses = value.statuses ?? [];
    if (statuses.length === 0) continue;
    let integrationQuery = admin.from("tenant_integrations_vault").select("tenant_id")
      .eq("provider", "whatsapp_cloud_api").eq("is_connected", true)
      .filter("public_metadata->>phone_number_id", "eq", value.metadata.phone_number_id);
    if (tenantId) integrationQuery = integrationQuery.eq("tenant_id", tenantId);
    const { data: integration, error: integrationError } = await integrationQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration) continue;
    for (const status of statuses) {
      const errorReason = status.status === "failed"
        ? status.errors?.map((item) => item.message ?? item.error_data?.details ?? item.title).filter(Boolean).join("; ").slice(0, 500) || "Meta reportó un fallo de entrega."
        : null;
      const { data, error } = await admin.from("messages").update({ status: status.status, error_reason: errorReason })
        .eq("tenant_id", integration.tenant_id).eq("wa_message_id", status.id).eq("direction", "outbound").select("id");
      if (error) throw error;
      updated += data?.length ?? 0;
    }
  }
  return updated;
}

/** Ingiesta mensajes y estados por línea; los campos no soportados no bloquean el lote. */
export async function ingestWhatsAppPayload(payload: WhatsAppPayload, admin = createAdminClient(), scope: WhatsAppIngestionScope = {}): Promise<{
  received: number; inserted: number; statusesUpdated: number; templatesUpdated: number; templatesUnmatched: number;
  templateEventsIgnored: number; ignoredFields: Record<string, number>; insertedWaMessageIds: string[];
}> {
  const { messageValues, templateChanges, ignoredFields } = validateWhatsAppChanges(payload, scope);
  const batches = new Map<string, NormalizedMessage[]>();
  for (const value of messageValues) {
    const phoneNumberId = value.metadata.phone_number_id;
    const messages = (value.messages ?? []).map((message) => normalizeMessage(message, value.contacts ?? []));
    if (messages.length > 0) batches.set(phoneNumberId, [...(batches.get(phoneNumberId) ?? []), ...messages]);
  }

  let received = 0;
  let inserted = 0;
  const insertedWaMessageIds: string[] = [];
  for (const [phoneNumberId, messages] of batches) {
    received += messages.length;
    const uniqueMessages = [...new Map(messages.map((message) => [message.wa_message_id, message])).values()];
    const waMessageIds = uniqueMessages.map((message) => message.wa_message_id);
    let existingQuery = admin.from("messages").select("wa_message_id").in("wa_message_id", waMessageIds);
    if (scope.tenantId) existingQuery = existingQuery.eq("tenant_id", scope.tenantId);
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw existingError;
    const existingIds = new Set((existing ?? []).map((item) => item.wa_message_id));
    const { data, error } = await admin.rpc(scope.tenantId ? "ingest_whatsapp_messages_for_tenant" : "ingest_whatsapp_messages", {
      p_phone_number_id: phoneNumberId, p_messages: uniqueMessages,
      ...(scope.tenantId ? { p_tenant_id: scope.tenantId } : {}),
    });
    if (error) throw new Error(`Supabase RPC ingest_whatsapp_messages: ${error.message}`);
    const batchInserted = z.number().int().nonnegative().parse(data);
    inserted += batchInserted;
    if (batchInserted > 0) insertedWaMessageIds.push(...waMessageIds.filter((id) => !existingIds.has(id)));
  }
  const statusesUpdated = await updateDeliveryStatuses(messageValues, admin, scope.tenantId);
  const templateResult = await processTemplateStatusChanges(templateChanges, admin, scope.tenantId);
  return { received, inserted, statusesUpdated, ...templateResult, ignoredFields, insertedWaMessageIds };
}
