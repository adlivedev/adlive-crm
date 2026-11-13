import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { MessageType } from "@/shared/types/database";

const mediaSchema = z.object({
  caption: z.string().max(4096).optional(),
  mime_type: z.string().max(100).optional(),
  filename: z.string().max(255).optional(),
}).passthrough();

const messageSchema = z.object({
  from: z.string().regex(/^\d{7,20}$/),
  id: z.string().min(1).max(150),
  timestamp: z.string().regex(/^\d{10}$/),
  type: z.string().min(1).max(40),
  text: z.object({ body: z.string().max(4096) }).optional(),
  image: mediaSchema.optional(),
  audio: mediaSchema.optional(),
  video: mediaSchema.optional(),
  document: mediaSchema.optional(),
  button: z.object({ text: z.string().max(1024) }).passthrough().optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string().max(1024) }).passthrough().optional(),
    list_reply: z.object({ title: z.string().max(1024) }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough();

const valueSchema = z.object({
  messaging_product: z.literal("whatsapp").optional(),
  metadata: z.object({ phone_number_id: z.string().min(1).max(100) }).passthrough(),
  contacts: z.array(z.object({
    wa_id: z.string().regex(/^\d{7,20}$/),
    profile: z.object({ name: z.string().min(1).max(200) }).passthrough(),
  }).passthrough()).max(1000).optional(),
  messages: z.array(messageSchema).max(1000).optional(),
  statuses: z.array(z.unknown()).max(1000).optional(),
}).passthrough();

export const whatsappPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.literal("messages"),
      value: valueSchema,
    }).passthrough()).max(100),
  }).passthrough()).max(100),
}).passthrough();

export type WhatsAppPayload = z.infer<typeof whatsappPayloadSchema>;
type WhatsAppMessage = z.infer<typeof messageSchema>;
type WhatsAppContact = NonNullable<z.infer<typeof valueSchema>["contacts"]>[number];

interface NormalizedMessage {
  wa_message_id: string;
  phone_e164: string;
  full_name: string;
  body: string;
  msg_type: MessageType;
  media_mime_type: string | null;
  occurred_at: string;
}

function messageContent(message: WhatsAppMessage): Pick<NormalizedMessage, "body" | "msg_type" | "media_mime_type"> {
  const interactiveText = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
  if (message.type === "text") return { body: message.text?.body ?? "", msg_type: "text", media_mime_type: null };
  if (message.type === "button") return { body: message.button?.text ?? "[Respuesta de botón]", msg_type: "text", media_mime_type: null };
  if (message.type === "interactive") return { body: interactiveText ?? "[Respuesta interactiva]", msg_type: "text", media_mime_type: null };
  if (message.type === "image") return { body: message.image?.caption ?? "[Imagen recibida]", msg_type: "image", media_mime_type: message.image?.mime_type ?? null };
  if (message.type === "audio") return { body: "[Nota de voz recibida]", msg_type: "audio", media_mime_type: message.audio?.mime_type ?? null };
  if (message.type === "video") return { body: message.video?.caption ?? "[Video recibido]", msg_type: "video", media_mime_type: message.video?.mime_type ?? null };
  if (message.type === "document") return { body: message.document?.caption ?? message.document?.filename ?? "[Documento recibido]", msg_type: "document", media_mime_type: message.document?.mime_type ?? null };
  return { body: `[Mensaje de WhatsApp no compatible: ${message.type}]`, msg_type: "system", media_mime_type: null };
}

function normalizeMessage(message: WhatsAppMessage, contacts: WhatsAppContact[]): NormalizedMessage {
  const profileName = contacts.find((contact) => contact.wa_id === message.from)?.profile.name;
  return {
    wa_message_id: message.id,
    phone_e164: `+${message.from}`,
    full_name: profileName ?? `WhatsApp +${message.from}`,
    occurred_at: new Date(Number(message.timestamp) * 1000).toISOString(),
    ...messageContent(message),
  };
}

/** Agrupa por línea para hacer una única llamada transaccional por tenant. */
export async function ingestWhatsAppPayload(payload: WhatsAppPayload): Promise<{ received: number; inserted: number }> {
  const batches = new Map<string, NormalizedMessage[]>();
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const phoneNumberId = change.value.metadata.phone_number_id;
      const contacts = change.value.contacts ?? [];
      const messages = (change.value.messages ?? []).map((message) => normalizeMessage(message, contacts));
      if (messages.length === 0) continue;
      batches.set(phoneNumberId, [...(batches.get(phoneNumberId) ?? []), ...messages]);
    }
  }

  const admin = createAdminClient();
  let received = 0;
  let inserted = 0;
  for (const [phoneNumberId, messages] of batches) {
    received += messages.length;
    const { data, error } = await admin.rpc("ingest_whatsapp_messages", {
      p_phone_number_id: phoneNumberId,
      p_messages: messages,
    });
    if (error) throw new Error(`Supabase RPC ingest_whatsapp_messages: ${error.message}`);
    inserted += z.number().int().nonnegative().parse(data);
  }
  return { received, inserted };
}
