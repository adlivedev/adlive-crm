import { NextResponse } from "next/server";
import { z } from "zod";

import { createMetaTemplate, listMetaTemplates } from "@/shared/lib/metaWhatsAppClient";
import { authErrorStatus, requireTenantAdmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";
const buttonSchema = z.object({ type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]), text: z.string().trim().min(1).max(25), url: z.string().url().max(2048).optional(), phone_number: z.string().max(30).optional() });
const variableMappingSchema = z.object({
  slot: z.string().regex(/^\{\{\d+\}\}$/),
  label: z.string().trim().min(1).max(80),
  crmField: z.string().trim().min(1).max(60),
});
const templateSchema = z.object({
  tenantId: z.string().uuid(), name: z.string().regex(/^[a-z0-9_]{3,150}$/),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]), language: z.string().trim().min(2).max(20),
  body_text: z.string().trim().min(1).max(1024), footer_text: z.string().trim().max(60).nullable().optional(),
  variables_count: z.number().int().min(0).max(20), header_type: z.enum(["NONE", "TEXT"]).default("NONE"),
  header_content: z.string().trim().max(60).nullable().optional(), buttons: z.array(buttonSchema).max(10).default([]),
  variable_mappings: z.array(variableMappingSchema).max(20).default([]),
  default_header_media_url: z.string().url().max(2048).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const input = templateSchema.parse(await request.json());
    await requireTenantAdmin(input.tenantId);
    const metaId = await createMetaTemplate(input.tenantId, input);
    const { tenantId: _tenantId, ...template } = input;
    const { data, error } = await createAdminClient().from("whatsapp_templates").insert({
      ...template, tenant_id: input.tenantId, meta_template_id: metaId, status: "PENDING", rejection_reason: "NONE",
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? (error instanceof Error ? error.message : "No se pudo crear la plantilla.") : "No autorizado." }, { status: status === 500 ? 400 : status });
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = z.object({ tenantId: z.string().uuid() }).parse(await request.json());
    await requireTenantAdmin(tenantId);
    const remote = await listMetaTemplates(tenantId);
    const admin = createAdminClient();
    const payload = remote.map((item) => {
      const body = item.components?.find((component) => component.type === "BODY");
      const header = item.components?.find((component) => component.type === "HEADER");
      const footer = item.components?.find((component) => component.type === "FOOTER");
      const buttonComponent = item.components?.find((component) => component.type === "BUTTONS");
      const variables = new Set([...(body?.text ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])));
      return {
        tenant_id: tenantId, meta_template_id: item.id, name: item.name, category: item.category,
        language: item.language, status: item.status, header_type: header?.format ?? "NONE",
        header_content: header?.text ?? null, body_text: body?.text ?? "", footer_text: footer?.text ?? null,
        buttons: buttonComponent?.buttons ?? [], variables_count: variables.size > 0 ? Math.max(...variables) : 0,
        rejection_reason: "NONE", updated_at: new Date().toISOString(),
      };
    });
    if (payload.length > 0) {
      const { error } = await admin.from("whatsapp_templates").upsert(payload, { onConflict: "tenant_id,name,language" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, synchronized: payload.length });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? (error instanceof Error ? error.message : "No se pudo sincronizar.") : "No autorizado." }, { status });
  }
}
