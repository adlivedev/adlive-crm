import { NextResponse } from "next/server";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { TenantIntegrationRecord } from "@/shared/services/tenantIntegrationService";
import { handleWhatsAppPost, verifyWhatsAppChallenge, WHATSAPP_MAX_BODY_BYTES } from "@/shared/services/whatsappTenantWebhookHandler";
import { parseWebhookJson, readWebhookBody, webhookError, WebhookHttpError } from "@/shared/services/webhookHttp";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function routingHints(json: unknown): { phoneNumberIds: string[]; wabaIds: string[] } {
  const phoneNumberIds = new Set<string>();
  const wabaIds = new Set<string>();
  if (!json || typeof json !== "object") return { phoneNumberIds: [], wabaIds: [] };
  const entries = (json as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return { phoneNumberIds: [], wabaIds: [] };
  for (const entry of entries.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id === "string" && /^\d{1,100}$/.test(id)) wabaIds.add(id);
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes.slice(0, 100)) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;
      const metadata = (value as { metadata?: unknown }).metadata;
      if (!metadata || typeof metadata !== "object") continue;
      const phoneNumberId = (metadata as { phone_number_id?: unknown }).phone_number_id;
      if (typeof phoneNumberId === "string" && /^\d{1,100}$/.test(phoneNumberId)) phoneNumberIds.add(phoneNumberId);
    }
  }
  return { phoneNumberIds: [...phoneNumberIds], wabaIds: [...wabaIds] };
}

function resolved(record: TenantIntegrationRecord) {
  return {
    ...record, public_metadata: record.public_metadata ?? {},
    credentials: decryptVaultCredentials(record.encrypted_credentials, record.tenant_id, "whatsapp_cloud_api"),
  };
}

/** Legacy: la URL no contiene tenant; se resuelve por línea/WABA y nunca por variables globales. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const token = params.get("hub.verify_token");
    if (!token) return NextResponse.json({ error: "Verificación no válida." }, { status: 403 });
    const { data, error } = await createAdminClient().from("tenant_integrations_vault")
      .select("id,tenant_id,provider,is_connected,public_metadata,encrypted_credentials,updated_at")
      .eq("provider", "whatsapp_cloud_api").eq("is_connected", true).limit(500);
    if (error) throw error;
    for (const record of (data ?? []) as TenantIntegrationRecord[]) {
      const integration = resolved(record);
      if (integration.credentials.verify_token && safeEqualSecret(token, integration.credentials.verify_token)) {
        return await verifyWhatsAppChallenge(request, integration);
      }
    }
    return NextResponse.json({ error: "Verificación no válida." }, { status: 403 });
  } catch (error) {
    return webhookError(error, "No se pudo verificar el webhook.");
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await readWebhookBody(request, WHATSAPP_MAX_BODY_BYTES);
    const hints = routingHints(parseWebhookJson(rawBody));
    const field = hints.phoneNumberIds.length > 0 ? "public_metadata->>phone_number_id" : "public_metadata->>waba_id";
    const values = hints.phoneNumberIds.length > 0 ? hints.phoneNumberIds : hints.wabaIds;
    if (values.length === 0) throw new WebhookHttpError("No se pudo resolver el workspace por Phone Number ID o WABA.", 404);
    const { data, error } = await createAdminClient().from("tenant_integrations_vault")
      .select("id,tenant_id,provider,is_connected,public_metadata,encrypted_credentials,updated_at")
      .eq("provider", "whatsapp_cloud_api").eq("is_connected", true)
      .filter(field, "in", `(${values.join(",")})`).limit(20);
    if (error) throw error;
    const candidates = (data ?? []) as TenantIntegrationRecord[];
    if (candidates.length === 0) throw new WebhookHttpError("Integración de WhatsApp no encontrada.", 404);
    const signature = request.headers.get("x-hub-signature-256");
    for (const record of candidates) {
      const integration = resolved(record);
      if (isValidMetaSignature(rawBody, signature, integration.credentials.app_secret)) {
        return await handleWhatsAppPost(request, integration, rawBody);
      }
    }
    throw new WebhookHttpError("Firma no válida.", 401);
  } catch (error) {
    return webhookError(error, "No se pudo procesar el mensaje.");
  }
}
