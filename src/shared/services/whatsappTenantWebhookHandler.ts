import "server-only";

import { after, NextResponse } from "next/server";

import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { processAiBotReply } from "@/shared/services/aiBotService";
import { enqueueSlaAlertJob, ensureDailySummaryJob, notifyInboundMessage } from "@/shared/services/conversationAlertService";
import type { ResolvedTenantIntegration } from "@/shared/services/tenantIntegrationService";
import { credential, publicCredential } from "@/shared/services/tenantIntegrationService";
import { WebhookHttpError, parseWebhookJson, readWebhookBody, webhookError } from "@/shared/services/webhookHttp";
import { executeWorkflowsForFirstInboundMessage } from "@/shared/services/workflowExecutionService";
import {
  ingestWhatsAppPayload, validateWhatsAppChanges, WhatsAppChangeValidationError,
  WhatsAppTenantMismatchError, whatsappPayloadSchema,
} from "@/shared/services/whatsappWebhookService";

export const WHATSAPP_MAX_BODY_BYTES = 3_000_000;

/** Motor de workflows: al llegar el PRIMER mensaje del lead, ejecuta en el
  servidor los workflows publicados con disparador «Mensaje recibido en WhatsApp». */
async function triggerWorkflowsForFirstMessage(tenantId: string, waMessageIds: string[]) {
  for (const waMessageId of waMessageIds) {
    try {
      await executeWorkflowsForFirstInboundMessage(tenantId, waMessageId);
    } catch (error) {
      console.error("WhatsApp workflow trigger failed", error instanceof Error ? error.message : "unknown error");
    }
  }
}

export async function verifyWhatsAppChallenge(request: Request, integration: ResolvedTenantIntegration): Promise<Response> {
  const verifyToken = credential(integration, "verify_token");
  if (!verifyToken) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge || !safeEqualSecret(token, verifyToken)) {
    return NextResponse.json({ error: "Verificación no válida." }, { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

async function ingestDeferred(payload: Parameters<typeof ingestWhatsAppPayload>[0], integration: ResolvedTenantIntegration) {
  const phoneNumberId = publicCredential(integration, "phone_number_id");
  const scope = { tenantId: integration.tenant_id, phoneNumberId };
  const { insertedWaMessageIds, ...result } = await ingestWhatsAppPayload(payload, undefined, scope);
  console.info("WhatsApp tenant webhook procesado", JSON.stringify({ tenantId: integration.tenant_id, ...result }));
  for (const waMessageId of insertedWaMessageIds) {
    try { await processAiBotReply(waMessageId, integration.tenant_id); }
    catch (error) { console.error("WhatsApp AI reply failed", error instanceof Error ? error.message : "unknown error"); }
    try { await notifyInboundMessage(integration.tenant_id, waMessageId); }
    catch (error) { console.error("WhatsApp inbound notification failed", error instanceof Error ? error.message : "unknown error"); }
  }
  await triggerWorkflowsForFirstMessage(integration.tenant_id, insertedWaMessageIds);
}

export async function handleWhatsAppPost(
  request: Request,
  integration: ResolvedTenantIntegration,
  providedRawBody?: string,
): Promise<NextResponse> {
  try {
    const rawBody = providedRawBody ?? await readWebhookBody(request, WHATSAPP_MAX_BODY_BYTES);
    if (Buffer.byteLength(rawBody, "utf8") > WHATSAPP_MAX_BODY_BYTES) throw new WebhookHttpError("Payload demasiado grande.", 413);
    const appSecret = credential(integration, "app_secret");
    if (!appSecret) throw new WebhookHttpError("Webhook no configurado.", 503);
    if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
      throw new WebhookHttpError("Firma no válida.", 401);
    }
    const parsed = whatsappPayloadSchema.safeParse(parseWebhookJson(rawBody));
    if (!parsed.success) throw new WebhookHttpError("Payload de WhatsApp no válido.", 400);
    const phoneNumberId = publicCredential(integration, "phone_number_id");
    if (!phoneNumberId) throw new WebhookHttpError("La integración no tiene Phone Number ID.", 503);
    const validated = validateWhatsAppChanges(parsed.data, { tenantId: integration.tenant_id, phoneNumberId });
    const hasMessages = validated.messageValues.some((value) => (value.messages?.length ?? 0) > 0);

    /* Los eventos sin mensajes se validan y confirman antes del trabajo diferido.
       No se declara un SLA: la resolución de credenciales y la red dependen del despliegue. */
    if (!hasMessages) {
      after(async () => {
        try { await ingestDeferred(parsed.data, integration); }
        catch (error) { console.error("WhatsApp deferred webhook failed", error instanceof Error ? error.message : "unknown error"); }
      });
      return NextResponse.json({ ok: true, accepted: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const { insertedWaMessageIds, ...result } = await ingestWhatsAppPayload(parsed.data, undefined, {
      tenantId: integration.tenant_id, phoneNumberId,
    });
    after(async () => {
      for (const waMessageId of insertedWaMessageIds) {
        try { await processAiBotReply(waMessageId, integration.tenant_id); }
        catch (error) { console.error("WhatsApp AI reply failed", error instanceof Error ? error.message : "unknown error"); }
        try { await notifyInboundMessage(integration.tenant_id, waMessageId); }
        catch (error) { console.error("WhatsApp inbound notification failed", error instanceof Error ? error.message : "unknown error"); }
      }
      // Fase 2 — SLA: programa la alerta de «sin respuesta >1 h» por conversación.
      try {
        const { data: pendingConversations } = await createAdminClient().from("conversations")
          .select("id").eq("tenant_id", integration.tenant_id).eq("handler_mode", "human").eq("needs_reply", true);
        for (const conversation of pendingConversations ?? []) {
          await enqueueSlaAlertJob(integration.tenant_id, conversation.id, 1);
        }
      } catch (error) { console.error("WhatsApp SLA enqueue failed", error instanceof Error ? error.message : "unknown error"); }
      try { await ensureDailySummaryJob(integration.tenant_id); }
      catch (error) { console.error("Daily summary enqueue failed", error instanceof Error ? error.message : "unknown error"); }
      await triggerWorkflowsForFirstMessage(integration.tenant_id, insertedWaMessageIds);
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WhatsAppChangeValidationError) return NextResponse.json({ error: "Contenido del webhook no válido." }, { status: 400 });
    if (error instanceof WhatsAppTenantMismatchError) return NextResponse.json({ error: "La línea no pertenece a este workspace." }, { status: 403 });
    return webhookError(error, "No se pudo procesar el mensaje.");
  }
}
