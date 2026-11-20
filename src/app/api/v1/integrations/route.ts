import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptVaultCredentials, decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { authErrorStatus, requireTenantAdmin, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { testTenantConnection } from "@/shared/services/integrationConnectionService";
import { generateVerifyToken, integrationProviderSchema } from "@/shared/services/tenantIntegrationService";
import type { IntegrationProvider } from "@/shared/types/database";

export const runtime = "nodejs";

const tenantSchema = z.string().uuid();
const credentialSchema = z.record(z.string().trim().min(1).max(100), z.string().max(4096));
const PUBLIC_FIELDS: Record<IntegrationProvider, string[]> = {
  whatsapp_cloud_api: ["phone_number_id", "waba_id"],
  facebook_lead_ads: ["ad_account_id", "page_id"], instagram: ["ig_user_id", "page_id"],
  tiktok_ads: ["advertiser_id"], twilio: ["account_sid"], telnyx: ["messaging_profile_id"],
};
const REQUIRED_FIELDS: Record<IntegrationProvider, string[]> = {
  whatsapp_cloud_api: ["phone_number_id", "waba_id", "access_token", "app_secret"],
  facebook_lead_ads: ["ad_account_id", "page_id", "access_token", "app_secret"],
  instagram: ["ig_user_id", "page_id", "access_token", "app_secret"],
  tiktok_ads: ["advertiser_id", "access_token", "webhook_secret"],
  twilio: ["account_sid", "auth_token"],
  telnyx: ["api_key", "messaging_profile_id", "public_key"],
};
const SECRET_FIELDS = new Set(["access_token", "auth_token", "api_key"]);

function mask(values: Record<string, string>): string | null {
  const entry = Object.entries(values).find(([key, value]) => SECRET_FIELDS.has(key) && value.trim());
  return entry ? `${entry[1].trim().slice(0, 4)}••••••••` : null;
}

function authFailure(error: unknown, fallback: string) {
  const status = authErrorStatus(error);
  return NextResponse.json(
    { error: status === 500 ? fallback : "No autorizado." },
    { status: status === 500 && error instanceof z.ZodError ? 400 : status },
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tenantId = tenantSchema.parse(params.get("tenantId"));
    const includeWebhookToken = params.get("includeWebhookToken") === "1";
    if (includeWebhookToken) await requireTenantAdmin(tenantId);
    else await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const { data, error } = await createAdminClient().from("tenant_integrations_vault")
      .select("id,tenant_id,provider,is_connected,public_metadata,encrypted_credentials,updated_at")
      .eq("tenant_id", tenantId).not("provider", "like", "ai_%");
    if (error) throw error;
    const integrations = (data ?? []).filter((item) => integrationProviderSchema.safeParse(item.provider).success)
      .map((item) => {
        const base = {
          id: item.id, tenant_id: item.tenant_id, provider: item.provider,
          is_connected: item.is_connected, public_metadata: item.public_metadata ?? {}, updated_at: item.updated_at,
          masked_key: typeof item.public_metadata?.masked_key === "string" ? item.public_metadata.masked_key : null,
        };
        if (!includeWebhookToken || !["whatsapp_cloud_api", "facebook_lead_ads", "instagram"].includes(item.provider)) return base;
        const credentials = decryptVaultCredentials(item.encrypted_credentials, tenantId, item.provider);
        return { ...base, verify_token: credentials.verify_token?.trim() || null };
      });
    return NextResponse.json({ integrations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authFailure(error, "No se pudieron cargar las integraciones.");
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantSchema, provider: integrationProviderSchema, credentials: credentialSchema }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
    const { tenantId, provider, credentials } = parsed.data;
    await requireTenantAdmin(tenantId);
    if (Object.keys(credentials).length > 30) return NextResponse.json({ error: "Demasiados campos de configuración." }, { status: 400 });
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin.from("tenant_integrations_vault")
      .select("encrypted_credentials").eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();
    if (existingError) throw existingError;
    const previous = existing ? decryptVaultCredentials(existing.encrypted_credentials, tenantId, provider) : {};
    const normalized = Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    const merged = { ...previous, ...normalized };
    if (["whatsapp_cloud_api", "facebook_lead_ads", "instagram"].includes(provider) && !merged.verify_token) merged.verify_token = generateVerifyToken();
    if (merged.verify_token && !/^[a-zA-Z0-9_-]{16,128}$/.test(merged.verify_token)) {
      return NextResponse.json({ error: "El Verify Token debe tener entre 16 y 128 caracteres seguros." }, { status: 400 });
    }
    const missing = REQUIRED_FIELDS[provider].filter((key) => !merged[key]?.trim());
    if (missing.length > 0) return NextResponse.json({ error: `Faltan campos obligatorios: ${missing.join(", ")}.` }, { status: 400 });
    const publicMetadata = Object.fromEntries(PUBLIC_FIELDS[provider].filter((key) => merged[key]).map((key) => [key, merged[key]!]));
    const maskedKey = mask(merged);
    if (maskedKey) publicMetadata.masked_key = maskedKey;
    const { data, error } = await admin.from("tenant_integrations_vault").upsert({
      tenant_id: tenantId, provider, is_connected: true, public_metadata: publicMetadata,
      encrypted_credentials: encryptVaultCredentials(merged, tenantId, provider), updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" }).select("id,tenant_id,provider,is_connected,public_metadata,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ integration: { ...data, masked_key: maskedKey, verify_token: ["whatsapp_cloud_api", "facebook_lead_ads", "instagram"].includes(provider) ? merged.verify_token : undefined } });
  } catch (error) {
    return authFailure(error, "No se pudo guardar la integración.");
  }
}

export async function POST(request: Request) {
  try {
    const input = z.object({
      tenantId: tenantSchema, provider: integrationProviderSchema,
      action: z.enum(["test", "regenerate-verify-token"]),
    }).parse(await request.json());
    await requireTenantAdmin(input.tenantId);
    if (input.action === "test") {
      await testTenantConnection(input.tenantId, input.provider);
      return NextResponse.json({ ok: true, message: "La conexión respondió correctamente." });
    }
    if (!["whatsapp_cloud_api", "facebook_lead_ads", "instagram"].includes(input.provider)) {
      return NextResponse.json({ error: "Este proveedor no utiliza Verify Token de Meta." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin.from("tenant_integrations_vault")
      .select("encrypted_credentials").eq("tenant_id", input.tenantId).eq("provider", input.provider).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: "Primero guarda la configuración del proveedor." }, { status: 404 });
    const credentials = decryptVaultCredentials(existing.encrypted_credentials, input.tenantId, input.provider);
    credentials.verify_token = generateVerifyToken();
    const { error } = await admin.from("tenant_integrations_vault").update({
      encrypted_credentials: encryptVaultCredentials(credentials, input.tenantId, input.provider),
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", input.tenantId).eq("provider", input.provider);
    if (error) throw error;
    return NextResponse.json({ ok: true, verify_token: credentials.verify_token });
  } catch (error) {
    return authFailure(error, "No se pudo completar la acción de la integración.");
  }
}

export async function DELETE(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantSchema, provider: integrationProviderSchema }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Integración inválida." }, { status: 400 });
    await requireTenantAdmin(parsed.data.tenantId);
    const { error } = await createAdminClient().from("tenant_integrations_vault").update({ is_connected: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", parsed.data.tenantId).eq("provider", parsed.data.provider);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authFailure(error, "No se pudo desconectar.");
  }
}
