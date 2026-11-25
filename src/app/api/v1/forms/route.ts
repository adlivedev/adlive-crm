import { NextResponse } from "next/server";
import { z } from "zod";

import { formInputSchema } from "@/shared/lib/formsSchema";
import { sanitizeHtmlBlock } from "@/shared/lib/sanitizeHtml";
import { authErrorStatus, requireTenantAdmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

function sanitizeInput<T extends { html_blocks?: Array<{ id: string; content_html: string }> }>(input: T): T {
  return { ...input, html_blocks: (input.html_blocks ?? []).map((block) => ({ ...block, content_html: sanitizeHtmlBlock(block.content_html) })) };
}

/** Fase 2 — Constructor de formularios: lista los formularios del workspace. */
export async function GET(request: Request) {
  try {
    const tenantId = z.string().uuid().parse(new URL(request.url).searchParams.get("tenantId"));
    await requireTenantAdmin(tenantId);
    const { data, error } = await createAdminClient().from("tenant_forms")
      .select("id,tenant_id,slug,name,description,columns,is_multistep,steps,fields,html_blocks,theme_config,is_active,created_at,updated_at")
      .eq("tenant_id", tenantId).order("created_at");
    if (error) throw error;
    return NextResponse.json({ forms: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudieron cargar los formularios." : "No autorizado." }, { status: status === 500 && error instanceof z.ZodError ? 400 : status });
  }
}

/** Fase 2 — crea un formulario del constructor (solo owner/admin). */
export async function POST(request: Request) {
  try {
    const parsed = formInputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos del formulario inválidos.", details: parsed.error.flatten() }, { status: 400 });
    const input = sanitizeInput(parsed.data);
    await requireTenantAdmin(input.tenantId);
    const { tenantId, ...form } = input;
    const { data, error } = await createAdminClient().from("tenant_forms")
      .insert({ ...form, tenant_id: tenantId, updated_at: new Date().toISOString() })
      .select("id,slug").maybeSingle();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Ya existe un formulario con ese slug en este workspace." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ form: data }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status === 500) console.error("[forms]", error);
    return NextResponse.json({ error: status === 500 ? "No se pudo crear el formulario." : "No autorizado." }, { status });
  }
}
