"use client";

import { z } from "zod";

import { createClient, isSupabaseBrowserConfigured } from "@/shared/lib/supabase/client";
import type { Contact, Conversation, Message } from "@/shared/types/database";

const uuidSchema = z.string().uuid();
const nullableUuid = z.string().uuid().nullable();
const nullableDate = z.string().nullable();

const contactSchema = z.object({
  id: uuidSchema, tenant_id: uuidSchema, assigned_member_id: nullableUuid,
  full_name: z.string(), phone_e164: z.string(), email: z.string().nullable(),
  company_name: z.string().nullable(), lead_source: z.string().nullable(),
  tags: z.array(z.string()).nullable(), custom_fields: z.record(z.string(), z.string()),
  is_closed_client: z.boolean(), is_starred: z.boolean(), typification: z.string().nullable(),
  opt_out_marketing: z.boolean(), utm_source: z.string().nullable(), utm_medium: z.string().nullable(),
  utm_campaign: z.string().nullable(), utm_content: z.string().nullable(), utm_term: z.string().nullable(),
  fbclid: z.string().nullable(), landing_url: z.string().nullable(), referrer_url: z.string().nullable(),
  last_interaction_at: nullableDate, created_at: z.string(), updated_at: z.string(),
}).transform((row) => ({
  ...row,
  lead_source: row.lead_source ?? "WhatsApp",
  tags: row.tags ?? [],
})) satisfies z.ZodType<Contact>;

const conversationSchema = z.object({
  id: uuidSchema, tenant_id: uuidSchema, contact_id: uuidSchema, assigned_member_id: nullableUuid,
  channel: z.string(), handler_mode: z.enum(["bot", "human"]), unread_count: z.number().int(),
  needs_reply: z.boolean(), last_inbound_at: nullableDate, last_message_at: z.string(),
  last_message_preview: z.string().nullable(),
  last_message_media_type: z.enum(["text", "template", "image", "audio", "video", "document", "system"]).nullable(),
  created_at: z.string(),
}).transform((row) => ({ ...row, last_message_media_type: row.last_message_media_type ?? "text" })) satisfies z.ZodType<Conversation>;

const messageSchema = z.object({
  id: uuidSchema, tenant_id: uuidSchema, conversation_id: uuidSchema, sender_member_id: nullableUuid,
  wa_message_id: z.string().nullable(), in_reply_to_message_id: nullableUuid.optional(),
  direction: z.enum(["inbound", "outbound"]),
  msg_type: z.enum(["text", "template", "image", "audio", "video", "document", "system"]),
  body: z.string().nullable(), media_url: z.string().nullable(), media_id: z.string().nullable().optional(), media_mime_type: z.string().nullable(),
  template_name: z.string().nullable(), status: z.enum(["queued", "sent", "delivered", "read", "failed"]),
  error_reason: z.string().nullable(), created_at: z.string(),
}) satisfies z.ZodType<Message>;

interface InboxRealtimeHandlers {
  onContact: (contact: Contact) => void;
  onConversation: (conversation: Conversation) => void;
  onMessage: (message: Message) => void;
}

/** Suscripción privada: RLS vuelve a filtrar cada evento en Supabase. */
export function subscribeToInboxRealtime(tenantId: string, handlers: InboxRealtimeHandlers): (() => void) | null {
  if (!isSupabaseBrowserConfigured() || !uuidSchema.safeParse(tenantId).success) return null;
  const supabase = createClient();
  const filter = `tenant_id=eq.${tenantId}`;
  const channel = supabase.channel(`adlive-inbox:${tenantId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter }, (payload: { new: unknown }) => {
      const parsed = contactSchema.safeParse(payload.new);
      if (parsed.success) handlers.onContact(parsed.data);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter }, (payload: { new: unknown }) => {
      const parsed = conversationSchema.safeParse(payload.new);
      if (parsed.success) handlers.onConversation(parsed.data);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter }, (payload: { new: unknown }) => {
      const parsed = messageSchema.safeParse(payload.new);
      if (parsed.success) handlers.onMessage(parsed.data);
    });

  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
