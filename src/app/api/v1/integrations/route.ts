import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { authErrorStatus, requireTenantAdmin, requireTenantMember } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const providerSchema = z.enum(["whatsapp_cloud_api", "facebook_lead_ads", "instagram", "tiktok_ads", "twilio", "telnyx"]);
const tenantSchema = z.string().uuid();
const credentialSchema = z.record(z.string().trim().min(1).max(100), z.string().max(4096));
const PUBLIC_FIELDS: Record<z.infer<typeof providerSchema>, string[]> = {
  whatsapp_cloud_api: ["phone_number_id", "waba_id"],
  facebook_lead_ads: ["ad_account_id", "page_id"], instagram: ["ig_user_id", "page_id"],
  tiktok_ads: ["advertiser_id"], twilio: ["account_sid"], telnyx: ["messaging_profile_id"],
};
const SECRET_FIELDS = new Set(["access_token", "auth_token", "api_key"]);

function mask(values: Record<string, string>): string | null {
  const entry = Object.entries(values).find(([key, value]) => SECRET_FIELDS.has(key) && value.trim());
  return entry ? `${entry[1].trim().slice(0, 4)}••••••••` : null;
}

export async function GET(request: Request) {
  try {
    const tenantId = tenantSchema.parse(new URL(request.url).searchParams.get("tenantId"));
    await requireTenantMember(tenantId);
    const { data, error } = await createAdminClient().from("tenant_integrations_vault")
      .select("id,tenant_id,provider,is_connected,public_metadata,updated_at").eq("tenant_id", tenantId)
      .not("provider", "like", "ai_%");
    if (error) throw error;
    const integrations = (data ?? []).filter((item) => providerSchema.safeParse(item.provider).success)
      .map((item) => ({ ...item, masked_key: typeof item.public_metadata?.masked_key === "string" ? item.public_metadata.masked_key : null }));
    return NextResponse.json({ integrations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudieron cargar las integraciones." : "No autorizado." }, { status: status === 500 && error instanceof z.ZodError ? 400 : status });
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantSchema, provider: providerSchema, credentials: credentialSchema }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
    const { tenantId, provider, credentials } = parsed.data;
    await requireTenantAdmin(tenantId);
    if (Object.keys(credentials).length > 30) return NextResponse.json({ error: "Demasiados campos de configuración." }, { status: 400 });
    if (provider === "whatsapp_cloud_api" && (!credentials.phone_number_id?.trim() || !credentials.waba_id?.trim() || !credentials.access_token?.trim())) {
      return NextResponse.json({ error: "WhatsApp requiere Phone Number ID, WABA ID y Access Token." }, { status: 400 });
    }
    const normalized = Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    const publicMetadata = Object.fromEntries(PUBLIC_FIELDS[provider].filter((key) => normalized[key]).map((key) => [key, normalized[key]!]));
    const maskedKey = mask(normalized);
    if (maskedKey) publicMetadata.masked_key = maskedKey;
    const { data, error } = await createAdminClient().from("tenant_integrations_vault").upsert({
      tenant_id: tenantId, provider, is_connected: true, public_metadata: publicMetadata,
      encrypted_credentials: encryptVaultCredentials(normalized, tenantId, provider), updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" }).select("id,tenant_id,provider,is_connected,public_metadata,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ integration: { ...data, masked_key: maskedKey } });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo guardar la integración." : "No autorizado." }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantSchema, provider: providerSchema }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Integración inválida." }, { status: 400 });
    await requireTenantAdmin(parsed.data.tenantId);
    const { error } = await createAdminClient().from("tenant_integrations_vault").update({ is_connected: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", parsed.data.tenantId).eq("provider", parsed.data.provider);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo desconectar." : "No autorizado." }, { status });
  }
}
