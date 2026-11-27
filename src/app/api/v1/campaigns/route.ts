import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin, requireTenantMemberOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { enqueueCampaignSend } from "@/shared/services/campaignService";
import type { Campaign } from "@/shared/types/database";

export const runtime = "nodejs";

const tenantSchema = z.string().uuid();

const filtersSchema = z.object({
  utm_source: z.string().trim().max(200).optional(),
  utm_campaign: z.string().trim().max(200).optional(),
  created_from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  created_to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const interactiveSchema = z.object({
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).nullish(),
  buttons: z.array(z.object({
    kind: z.enum(["reply", "cta_url"]),
    title: z.string().trim().min(1).max(20),
    url: z.string().trim().url().max(2048).optional(),
  })).min(1).max(3),
});

const baseCampaignSchema = z.object({
  tenantId: tenantSchema,
  name: z.string().trim().min(1).max(120),
  msg_type: z.enum(["template", "text", "interactive"]),
  template_name: z.string().trim().max(200).nullish(),
  body: z.string().trim().max(4096).default(""),
  interactive: interactiveSchema.nullish(),
  filters: filtersSchema.default({}),
  scheduled_at: z.string().datetime().nullish(),
});

function validateContent(input: z.infer<typeof baseCampaignSchema>): string | null {
  if (input.msg_type === "template" && !input.template_name?.trim()) return "Selecciona una plantilla aprobada.";
  if (input.msg_type === "text" && !input.body.trim()) return "Escribe el mensaje de la campaña.";
  if (input.msg_type === "interactive" && (!input.interactive || input.interactive.buttons.length === 0)) {
    return "Configura el mensaje interactivo con al menos un botón.";
  }
  return null;
}

function authFailure(error: unknown, fallback: string) {
  const status = authErrorStatus(error);
  return NextResponse.json(
    { error: status === 500 ? fallback : "No autorizado." },
    { status: status === 500 && error instanceof z.ZodError ? 400 : status },
  );
}

/** Lista las campañas del workspace (cualquier miembro puede verlas). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tenantId = tenantSchema.parse(params.get("tenantId"));
    await requireTenantMemberOrPlatformSuperadmin(tenantId);
    const { data, error } = await createAdminClient().from("campaigns").select("*")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ campaigns: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authFailure(error, "No se pudieron cargar las campañas.");
  }
}

/** Crea una campaña. NUNCA dispara el envío: queda en borrador o programada. */
export async function POST(request: Request) {
  try {
    const parsed = baseCampaignSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos de campaña inválidos." }, { status: 400 });
    const input = parsed.data;
    await requireTenantAdminOrPlatformSuperadmin(input.tenantId);
    const contentError = validateContent(input);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });

    const scheduledAt = input.scheduled_at && new Date(input.scheduled_at).getTime() > Date.now()
      ? input.scheduled_at : null;
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").insert({
      tenant_id: input.tenantId,
      name: input.name,
      msg_type: input.msg_type,
      template_name: input.msg_type === "template" ? input.template_name : null,
      body: input.msg_type === "template" ? "" : input.body,
      interactive: input.msg_type === "interactive" ? input.interactive : null,
      filters: input.filters,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt,
    }).select("id").single();
    if (error) throw error;
    /* Si se programó, se encola el primer lote para esa fecha; el cron lo toma. */
    if (scheduledAt) await enqueueCampaignSend(input.tenantId, data.id as string, scheduledAt);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return authFailure(error, "No se pudo crear la campaña.");
  }
}

/** Edita una campaña en borrador o programada (nunca una ya enviada). */
export async function PATCH(request: Request) {
  try {
    const parsed = baseCampaignSchema.extend({ campaignId: z.string().uuid() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos de campaña inválidos." }, { status: 400 });
    const input = parsed.data;
    await requireTenantAdminOrPlatformSuperadmin(input.tenantId);
    const contentError = validateContent(input);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });

    const admin = createAdminClient();
    const { data: existing } = await admin.from("campaigns").select("id,status")
      .eq("id", input.campaignId).eq("tenant_id", input.tenantId).maybeSingle();
    const campaign = existing as Pick<Campaign, "id" | "status"> | null;
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    if (campaign.status === "sending" || campaign.status === "sent") {
      return NextResponse.json({ error: "No se puede editar una campaña en envío o ya enviada." }, { status: 409 });
    }

    const scheduledAt = input.scheduled_at && new Date(input.scheduled_at).getTime() > Date.now()
      ? input.scheduled_at : null;
    const { error } = await admin.from("campaigns").update({
      name: input.name,
      msg_type: input.msg_type,
      template_name: input.msg_type === "template" ? input.template_name : null,
      body: input.msg_type === "template" ? "" : input.body,
      interactive: input.msg_type === "interactive" ? input.interactive : null,
      filters: input.filters,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    }).eq("id", input.campaignId).eq("tenant_id", input.tenantId);
    if (error) throw error;

    /* Reprogramación: se descartan los jobs pendientes anteriores y se encola uno nuevo. */
    await admin.from("background_jobs").delete()
      .eq("tenant_id", input.tenantId).eq("job_type", "campaign_send_batch")
      .eq("status", "pending").contains("payload", { campaign_id: input.campaignId });
    if (scheduledAt) await enqueueCampaignSend(input.tenantId, input.campaignId, scheduledAt);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authFailure(error, "No se pudo actualizar la campaña.");
  }
}

/** Elimina una campaña (y sus logs por cascade). Nunca dispara envíos. */
export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tenantId = tenantSchema.parse(params.get("tenantId"));
    const campaignId = z.string().uuid().parse(params.get("campaignId"));
    await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const admin = createAdminClient();
    const { data: existing } = await admin.from("campaigns").select("status")
      .eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    if ((existing as { status: string }).status === "sending") {
      return NextResponse.json({ error: "No se puede eliminar una campaña mientras se está enviando." }, { status: 409 });
    }
    await admin.from("background_jobs").delete()
      .eq("tenant_id", tenantId).eq("job_type", "campaign_send_batch")
      .eq("status", "pending").contains("payload", { campaign_id: campaignId });
    const { error } = await admin.from("campaigns").delete().eq("id", campaignId).eq("tenant_id", tenantId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authFailure(error, "No se pudo eliminar la campaña.");
  }
}
