import { NextResponse } from "next/server";
import { z } from "zod";

import { generateBotAnswerForTest } from "@/shared/services/aiBotService";
import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  botId: z.string().uuid(),
  testMessage: z.string().trim().min(1).max(2000),
});
const providerSchema = z.enum(["openai", "anthropic", "grok", "gemini"]);

/**
 * Sprint 2 — «Probar Bot en Vivo»: solo owner/admin del tenant o superadmin de
 * plataforma. Llama al proveedor configurado con la llave cifrada del vault y
 * devuelve la respuesta real del bot. No envía nada a WhatsApp ni crea
 * contactos ni mensajes.
 */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Solicitud de prueba inválida." }, { status: 400 });
    const { tenantId, botId, testMessage } = parsed.data;
    await requireTenantAdminOrPlatformSuperadmin(tenantId);

    const { data: bot, error: botError } = await createAdminClient().from("ai_bots")
      .select("provider,system_prompt").eq("id", botId).eq("tenant_id", tenantId).maybeSingle();
    if (botError) throw botError;
    if (!bot) return NextResponse.json({ error: "No se encontró el bot en este espacio de trabajo." }, { status: 404 });

    const parsedProvider = providerSchema.safeParse(bot.provider);
    if (!parsedProvider.success) return NextResponse.json({ error: "Este bot usa un proveedor de plataforma que no admite pruebas directas." }, { status: 400 });

    const reply = await generateBotAnswerForTest(parsedProvider.data, tenantId, bot.system_prompt, testMessage);
    return NextResponse.json({ reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo probar el bot. Verifica que el proveedor tenga una API Key válida." : "No autorizado." }, { status });
  }
}
