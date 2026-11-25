import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { LANDING_SLUGS } from "@/shared/lib/leadCapture";
import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const tenantIdSchema = z.string().uuid();
const color = z.string().regex(/^#[0-9a-f]{6}$/i).nullable();
const landingSchema = z.object({
  tenantId: tenantIdSchema,
  landingId: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  title: z.string().trim().min(2).max(200),
  subtitle: z.string().trim().max(2000).nullable(),
  cta_text: z.string().trim().min(2).max(80),
  color_mode: z.enum(["workspace", "custom"]),
  custom_primary_color: color,
  custom_bg_color: color,
  custom_text_color: color,
  form_id: z.string().uuid().nullable().optional(),
  font_family: z.enum(["Inter", "Plus Jakarta Sans", "DM Sans", "Roboto", "Poppins"]).nullable().optional(),
  sections_config: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean(),
});

function failure(error: unknown, fallback: string) {
  const status = authErrorStatus(error);
  return NextResponse.json({ error: status === 500 ? fallback : "No autorizado." }, { status });
}

export async function GET(request: Request) {
  try {
    const tenantId = tenantIdSchema.parse(new URL(request.url).searchParams.get("tenantId"));
    const { supabase } = await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const [{ data: tenant, error: tenantError }, { data: landings, error: landingsError }] = await Promise.all([
      supabase.from("tenants").select("id,public_webhook_token").eq("id", tenantId).single(),
      supabase.from("tenant_landings").select("*").eq("tenant_id", tenantId).in("slug", [...LANDING_SLUGS]).order("created_at"),
    ]);
    if (tenantError || landingsError) throw new Error("CAPTURE_LOAD_FAILED");
    return NextResponse.json({ token: tenant.public_webhook_token, landings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "No se pudo cargar la captación de leads.");
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = landingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Configuración de landing inválida." }, { status: 400 });
    const { tenantId, landingId, ...landing } = parsed.data;
    const { supabase } = await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const { data, error } = await supabase.from("tenant_landings").update({
      ...landing,
      custom_primary_color: landing.color_mode === "custom" ? landing.custom_primary_color : null,
      custom_bg_color: landing.color_mode === "custom" ? landing.custom_bg_color : null,
      custom_text_color: landing.color_mode === "custom" ? landing.custom_text_color : null,
    }).eq("id", landingId).eq("tenant_id", tenantId).in("slug", [...LANDING_SLUGS]).select("*").single();
    if (error) throw new Error("CAPTURE_UPDATE_FAILED");
    return NextResponse.json({ landing: data });
  } catch (error) {
    return failure(error, "No se pudo guardar la landing.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = z.object({ tenantId: tenantIdSchema, action: z.literal("regenerate-token") }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { supabase } = await requireTenantAdminOrPlatformSuperadmin(parsed.data.tenantId);
    const token = randomBytes(24).toString("hex");
    const { error } = await supabase.from("tenants").update({ public_webhook_token: token }).eq("id", parsed.data.tenantId);
    if (error) throw new Error("TOKEN_UPDATE_FAILED");
    return NextResponse.json({ token });
  } catch (error) {
    return failure(error, "No se pudo regenerar el token.");
  }
}
