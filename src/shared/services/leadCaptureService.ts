import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { CaptureField, CaptureWorkspace, TenantForm, TenantLanding } from "@/shared/lib/leadCapture";

const WORKSPACE_COLUMNS = "id,name,slug,public_webhook_token,branding";
const FIELD_COLUMNS = "id,field_key,field_label,field_type,options";
const LANDING_COLUMNS = "id,tenant_id,slug,name,template_key,title,subtitle,cta_text,color_mode,custom_primary_color,custom_bg_color,custom_text_color,form_id,font_family,sections_config,is_active,created_at,updated_at";
const FORM_COLUMNS = "id,tenant_id,slug,name,description,columns,is_multistep,steps,fields,html_blocks,theme_config,is_active,created_at,updated_at";

export async function getPublicCaptureWorkspace(workspaceSlug: string): Promise<{ workspace: CaptureWorkspace; fields: CaptureField[] } | null> {
  const admin = createAdminClient();
  const { data: workspace, error } = await admin.from("tenants").select(WORKSPACE_COLUMNS)
    .eq("slug", workspaceSlug).eq("status", "active").maybeSingle();
  if (error) throw new Error(`No se pudo cargar el workspace público: ${error.message}`);
  if (!workspace) return null;
  const { data: fields, error: fieldsError } = await admin.from("custom_field_definitions").select(FIELD_COLUMNS)
    .eq("tenant_id", workspace.id).order("created_at").limit(50);
  if (fieldsError) throw new Error(`No se pudieron cargar los campos: ${fieldsError.message}`);
  return { workspace: workspace as CaptureWorkspace, fields: (fields ?? []) as CaptureField[] };
}

export async function getPublicTenantLanding(workspaceSlug: string, landingSlug: string): Promise<{
  workspace: CaptureWorkspace;
  fields: CaptureField[];
  landing: TenantLanding;
} | null> {
  const capture = await getPublicCaptureWorkspace(workspaceSlug);
  if (!capture) return null;
  const { data: landing, error } = await createAdminClient().from("tenant_landings").select(LANDING_COLUMNS)
    .eq("tenant_id", capture.workspace.id).eq("slug", landingSlug).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`No se pudo cargar la landing: ${error.message}`);
  return landing ? { ...capture, landing: landing as TenantLanding } : null;
}

/** Fase 2 — carga pública de un formulario del constructor por slug. */
export async function getPublicTenantForm(tenantId: string, formSlug: string): Promise<TenantForm | null> {
  const { data, error } = await createAdminClient().from("tenant_forms").select(FORM_COLUMNS)
    .eq("tenant_id", tenantId).eq("slug", formSlug).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el formulario: ${error.message}`);
  return (data as TenantForm | null) ?? null;
}

/** Fase 2 — formulario vinculado a una landing (tenant_landings.form_id). */
export async function getTenantFormById(tenantId: string, formId: string): Promise<TenantForm | null> {
  const { data, error } = await createAdminClient().from("tenant_forms").select(FORM_COLUMNS)
    .eq("tenant_id", tenantId).eq("id", formId).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el formulario: ${error.message}`);
  return (data as TenantForm | null) ?? null;
}
