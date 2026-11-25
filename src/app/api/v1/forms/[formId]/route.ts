import { NextResponse } from "next/server";
import { z } from "zod";

import { sanitizeHtmlBlock } from "@/shared/lib/sanitizeHtml";
import { authErrorStatus, requireTenantAdmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  is_multistep: z.boolean().optional(),
  steps: z.array(z.object({ title: z.string().trim().min(1).max(120), field_keys: z.array(z.string().min(1).max(100)).max(30) })).max(10).optional(),
  fields: z.array(z.string().min(1).max(100)).max(30).optional(),
  html_blocks: z.array(z.object({ id: z.string().min(1).max(60), content_html: z.string().max(12_000) })).max(10).optional(),
  theme_config: z.object({
    card_bg: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    input_bg: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    button_color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    font_family: z.enum(["Inter", "Plus Jakarta Sans", "DM Sans", "Roboto", "Poppins"]).optional(),
  }).optional(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ formId: string }> };

/** Fase 2 — actualiza un formulario del constructor (solo owner/admin del tenant). */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { formId } = await context.params;
    if (!z.string().uuid().safeParse(formId).success) return NextResponse.json({ error: "Formulario no encontrado." }, { status: 404 });
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos del formulario inválidos." }, { status: 400 });
    const { tenantId, ...patch } = parsed.data;
    await requireTenantAdmin(tenantId);
    if (patch.html_blocks) {
      patch.html_blocks = patch.html_blocks.map((block) => ({ ...block, content_html: sanitizeHtmlBlock(block.content_html) }));
    }
    const { data, error } = await createAdminClient().from("tenant_forms")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", formId).eq("tenant_id", tenantId).select("id,slug").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Formulario no encontrado en este workspace." }, { status: 404 });
    return NextResponse.json({ form: data });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status === 500) console.error("[forms]", error);
    return NextResponse.json({ error: status === 500 ? "No se pudo actualizar el formulario." : "No autorizado." }, { status });
  }
}

/** Fase 2 — elimina un formulario del constructor (solo owner/admin del tenant). */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { formId } = await context.params;
    if (!z.string().uuid().safeParse(formId).success) return NextResponse.json({ error: "Formulario no encontrado." }, { status: 404 });
    const tenantId = z.string().uuid().parse(new URL(request.url).searchParams.get("tenantId"));
    await requireTenantAdmin(tenantId);
    const { data, error } = await createAdminClient().from("tenant_forms").delete()
      .eq("id", formId).eq("tenant_id", tenantId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Formulario no encontrado en este workspace." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status === 500) console.error("[forms]", error);
    return NextResponse.json({ error: status === 500 ? "No se pudo eliminar el formulario." : "No autorizado." }, { status: status === 500 && error instanceof z.ZodError ? 400 : status });
  }
}
