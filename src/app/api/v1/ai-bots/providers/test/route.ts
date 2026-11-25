import { NextResponse } from "next/server";
import { z } from "zod";

import { testProviderConnection } from "@/shared/services/aiBotService";
import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic", "grok", "gemini"]),
});

/** Fase 2 — «Probar conexión» por proveedor: solo owner/admin del tenant o
 * superadmin de plataforma. Hace una llamada real con la API key cifrada del
 * vault y devuelve un diagnóstico claro sin exponer secretos. */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { tenantId, provider } = parsed.data;
    await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const result = await testProviderConnection(provider, tenantId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status === 500) console.error("[ai-bots/providers/test]", error);
    return NextResponse.json({ error: status === 500 ? "No se pudo probar la conexión." : "No autorizado." }, { status });
  }
}
