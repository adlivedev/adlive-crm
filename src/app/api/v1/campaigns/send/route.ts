import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { enqueueCampaignSend } from "@/shared/services/campaignService";

export const runtime = "nodejs";

const sendSchema = z.object({
  tenantId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

function authFailure(error: unknown, fallback: string) {
  const status = authErrorStatus(error);
  return NextResponse.json(
    { error: status === 500 ? fallback : "No autorizado." },
    { status: status === 500 && error instanceof z.ZodError ? 400 : status },
  );
}

/**
 * «Enviar ahora»: única acción que dispara el envío masivo. Marca la campaña
 * como «sending» y encola el primer lote; el cron procesa los contactos
 * 1 por 1 en lotes para no saturar el servidor ni la API de Meta.
 */
export async function POST(request: Request) {
  try {
    const parsed = sendSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { tenantId, campaignId } = parsed.data;
    await requireTenantAdminOrPlatformSuperadmin(tenantId);

    const admin = createAdminClient();
    const { data: campaign } = await admin.from("campaigns").select("id,status")
      .eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    const status = (campaign as { status: string }).status;
    if (status === "sending") return NextResponse.json({ error: "La campaña ya se está enviando." }, { status: 409 });
    if (status === "sent") return NextResponse.json({ error: "La campaña ya fue enviada." }, { status: 409 });

    const { error } = await admin.from("campaigns").update({
      status: "sending", scheduled_at: null, updated_at: new Date().toISOString(),
    }).eq("id", campaignId).eq("tenant_id", tenantId);
    if (error) throw error;
    await enqueueCampaignSend(tenantId, campaignId, new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authFailure(error, "No se pudo iniciar el envío.");
  }
}
