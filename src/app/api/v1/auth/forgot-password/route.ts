import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { evaluateWorkspaceAccess } from "@/shared/lib/auth/workspaceAccess";
import { sendWorkspaceEmail } from "@/shared/lib/mail/smtpMailer";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Tenant } from "@/shared/types/database";

export const runtime = "nodejs";

const recoverySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  workspaceSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150).nullable().optional(),
});

const GENERIC_MESSAGE = "Si el correo está registrado y tiene acceso a este workspace, recibirás un enlace para restablecer la contraseña.";

function genericResponse() {
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

export async function POST(request: Request) {
  const parsed = recoverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe un correo y un workspace válidos." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const workspaceSlug = parsed.data.workspaceSlug || null;
    const tenantResult = await admin.from("tenants").select("id,name,slug,branding,status,created_at,updated_at")
      .eq("slug", workspaceSlug ?? "adlive").maybeSingle();
    const workspace = tenantResult.data as Tenant | null;
    if (tenantResult.error || !workspace) return genericResponse();

    const redirectTo = `${getAppOrigin(request)}/restablecer-contrasena${workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : ""}`;
    const linkResult = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: { redirectTo },
    });
    const actionLink = linkResult.data.properties?.action_link;
    const userId = linkResult.data.user?.id;
    if (linkResult.error || !actionLink || !userId) return genericResponse();

    const superadminResult = await admin.from("platform_superadmins").select("user_id").eq("user_id", userId).maybeSingle();
    const isPlatformSuperadmin = !superadminResult.error && Boolean(superadminResult.data);
    let hasActiveMembership = false;
    if (!isPlatformSuperadmin && workspaceSlug) {
      const memberResult = await admin.from("tenant_members").select("id").eq("tenant_id", workspace.id)
        .eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
      hasActiveMembership = Boolean(memberResult.data && !memberResult.error);
    }

    const decision = evaluateWorkspaceAccess({ isPlatformSuperadmin, workspaceSlug, workspace, hasActiveMembership });
    if (!decision.allowed) return genericResponse();

    const safeLink = escapeHtml(actionLink);
    const safeWorkspaceName = escapeHtml(workspace.name);
    try {
      await sendWorkspaceEmail({
        tenantId: workspace.id,
        to: parsed.data.email,
        subject: `Recupera tu contraseña · ${workspace.name}`,
        html: `<p>Recibimos una solicitud para restablecer tu contraseña de ${safeWorkspaceName}.</p><p style="text-align:center;margin:28px 0;"><a href="${safeLink}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-weight:bold;">Restablecer contraseña</a></p><p>Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.</p>`,
        text: `Restablece tu contraseña de ${workspace.name}: ${actionLink}`,
      });
    } catch {
      /* La respuesta no revela si el correo existe ni la configuración de SMTP. */
      console.error("No se pudo entregar el correo de recuperación mediante SMTP global.");
    }
    return genericResponse();
  } catch {
    return genericResponse();
  }
}
