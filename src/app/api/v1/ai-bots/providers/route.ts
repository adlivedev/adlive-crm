import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { authErrorStatus, requireTenantAdmin, requireTenantMember } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";
const providerSchema = z.enum(["openai", "anthropic", "grok", "gemini"]);
const tenantSchema = z.string().uuid();

export async function GET(request: Request) {
  try {
    const tenantId = tenantSchema.parse(new URL(request.url).searchParams.get("tenantId"));
    await requireTenantMember(tenantId);
    const { data, error } = await createAdminClient().from("tenant_integrations_vault")
      .select("provider,is_connected,public_metadata,updated_at").eq("tenant_id", tenantId).like("provider", "ai_%");
    if (error) throw error;
    return NextResponse.json({ providers: (data ?? []).map((item) => ({
      provider: item.provider.slice(3), is_connected: item.is_connected,
      masked_key: typeof item.public_metadata?.masked_key === "string" ? item.public_metadata.masked_key : null,
      updated_at: item.updated_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudieron cargar los proveedores." : "No autorizado." }, { status: status === 500 && error instanceof z.ZodError ? 400 : status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantSchema, provider: providerSchema, apiKey: z.string().trim().min(8).max(4096) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Proveedor o API key inválida." }, { status: 400 });
    const { tenantId, provider, apiKey } = parsed.data;
    await requireTenantAdmin(tenantId);
    const maskedKey = `${apiKey.slice(0, 4)}••••••••`;
    const { error } = await createAdminClient().from("tenant_integrations_vault").upsert({
      tenant_id: tenantId, provider: `ai_${provider}`, is_connected: true, public_metadata: { masked_key: maskedKey },
      encrypted_credentials: encryptVaultCredentials({ api_key: apiKey }, tenantId, `ai_${provider}`), updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });
    if (error) throw error;
    return NextResponse.json({ provider, is_connected: true, masked_key: maskedKey });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo guardar la API key." : "No autorizado." }, { status });
  }
}
