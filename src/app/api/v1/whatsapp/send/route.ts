import { NextResponse } from "next/server";
import { z } from "zod";

import { sendMetaTemplate, sendMetaText } from "@/shared/lib/metaWhatsAppClient";
import { authErrorStatus, requireUser } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { buildTemplateVariables, isWithinMetaWindow } from "@/shared/lib/whatsapp";

export const runtime = "nodejs";
const inputSchema = z.object({
  conversationId: z.string().uuid(), body: z.string().trim().min(1).max(4096),
  msg_type: z.enum(["text", "template"]).default("text"), template_name: z.string().max(150).nullable().optional(),
});

export async function POST(request: Request) {
  let pendingMessageId: string | null = null;
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    const input = inputSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const { data: conversation, error } = await supabase.from("conversations").select("id,tenant_id,contact_id,last_inbound_at").eq("id", input.conversationId).single();
    if (error || !conversation) return NextResponse.json({ error: "Conversación no encontrada o sin acceso." }, { status: 404 });
    const [{ data: member }, { data: contact }] = await Promise.all([
      supabase.from("tenant_members").select("id").eq("tenant_id", conversation.tenant_id).eq("user_id", user.id).eq("is_active", true).single(),
      supabase.from("contacts").select("*").eq("id", conversation.contact_id).single(),
    ]);
    if (!member || !contact) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    if (input.msg_type === "text" && !isWithinMetaWindow(conversation.last_inbound_at, new Date())) {
      return NextResponse.json({ error: "La ventana de 24 horas está cerrada. Usa una plantilla aprobada." }, { status: 409 });
    }
    let template: { name: string; language: string; body_text: string; variables_count: number; status: string } | null = null;
    let variables: string[] = [];
    if (input.msg_type === "template") {
      const { data } = await supabase.from("whatsapp_templates").select("name,language,body_text,variables_count,status")
        .eq("tenant_id", conversation.tenant_id).eq("name", input.template_name ?? "").eq("status", "APPROVED").maybeSingle();
      template = data;
      if (!template) return NextResponse.json({ error: "La plantilla no existe o no está aprobada." }, { status: 400 });
      variables = buildTemplateVariables(contact, template.variables_count);
      if (variables.some((value) => !value)) return NextResponse.json({ error: "Faltan valores variable_N del contacto para completar la plantilla." }, { status: 400 });
    }
    admin = createAdminClient();
    const preview = template
      ? variables.reduce(
          (text, value, index) => text.replaceAll(`{{${index + 1}}}`, value),
          template.body_text,
        )
      : input.body;
    const { data: pending, error: insertError } = await admin.from("messages").insert({
      tenant_id: conversation.tenant_id, conversation_id: conversation.id, sender_member_id: member.id,
      direction: "outbound", msg_type: input.msg_type, body: preview, template_name: template?.name ?? null, status: "queued",
    }).select("id").single();
    if (insertError || !pending) throw new Error(insertError?.message ?? "No se pudo registrar el mensaje.");
    pendingMessageId = pending.id;
    const waMessageId = template
      ? await sendMetaTemplate(conversation.tenant_id, contact.phone_e164, template, variables)
      : await sendMetaText(conversation.tenant_id, contact.phone_e164, input.body);
    await admin.from("messages").update({ wa_message_id: waMessageId, status: "sent" }).eq("id", pending.id);
    const now = new Date().toISOString();
    await admin.from("conversations").update({ last_message_at: now, last_message_preview: preview.slice(0, 120), last_message_media_type: input.msg_type, needs_reply: false, unread_count: 0 }).eq("id", conversation.id);
    await admin.from("contacts").update({ last_interaction_at: now }).eq("id", contact.id);
    return NextResponse.json({ ok: true, messageId: pending.id, waMessageId, status: "sent" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Los datos del mensaje no son válidos." }, { status: 400 });
    }
    if (admin && pendingMessageId) await admin.from("messages").update({ status: "failed", error_reason: error instanceof Error ? error.message.slice(0, 500) : "Error de envío" }).eq("id", pendingMessageId);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? (error instanceof Error ? error.message : "No se pudo enviar el mensaje.") : "No autorizado." }, { status: status === 500 ? 502 : status });
  }
}
