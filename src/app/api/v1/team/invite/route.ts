import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { sendWorkspaceEmail } from "@/shared/lib/mail/smtpMailer";
import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const inviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(["admin", "agent"]),
});

export async function POST(request: Request) {
  try {
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa el correo y el rol del invitado." }, { status: 400 });
    const input = parsed.data;
    // QA-003: owner/admin del tenant o superadmin de plataforma (override auditado).
    const { user, member } = await requireTenantAdminOrPlatformSuperadmin(input.tenantId);
    const admin = createAdminClient();
    const appUrl = getAppOrigin(request);
    const { data: tenant, error: tenantError } = await admin.from("tenants").select("slug,name").eq("id", input.tenantId).maybeSingle();
    if (tenantError || !tenant) return NextResponse.json({ error: "No se encontró el workspace para la invitación." }, { status: 400 });
    // El correo se entrega con el SMTP de plataforma (sendWorkspaceEmail): el SMTP
    // nativo de Supabase es inestable en producción (límite de 4 correos/hora en el
    // plan compartido) y provocaba invitaciones fallidas silenciosas.
    const redirectTo = `${appUrl}/login?workspace=${encodeURIComponent(tenant.slug)}`;
    const linkResult = await admin.auth.admin.generateLink({
      type: "invite",
      email: input.email,
      options: { redirectTo },
    });
    const invitedUser = linkResult.data.user;
    const actionLink = linkResult.data.properties?.action_link;
    if (linkResult.error || !invitedUser || !actionLink) {
      return NextResponse.json({ error: "No se pudo generar la invitación. Verifica el correo." }, { status: 400 });
    }
    const { error } = await admin.from("tenant_members").upsert({
      tenant_id: input.tenantId, user_id: invitedUser.id, email: input.email, role: input.role,
      is_active: true, can_view_all_contacts: input.role === "admin", presence: "offline",
    }, { onConflict: "tenant_id,email" });
    if (error) {
      await admin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
      return NextResponse.json({ error: "El usuario fue invitado, pero no se pudo guardar su membresía." }, { status: 500 });
    }
    try {
      await sendWorkspaceEmail({
        tenantId: input.tenantId,
        to: input.email,
        subject: `Te invitaron al equipo de ${tenant.name}`,
        html: `<p>Has sido invitado a unirte al equipo de <strong>${tenant.name}</strong> con el rol de <strong>${input.role === "admin" ? "administrador" : "agente"}</strong>.</p><p style="text-align:center;margin:28px 0;"><a href="${actionLink}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-weight:bold;">Aceptar invitación</a></p><p>Al aceptar, define tu contraseña y entra desde <a href="${redirectTo}">${redirectTo}</a>.</p><p>Si no esperabas esta invitación, ignora este correo.</p>`,
        text: `Acepta la invitación al equipo de ${tenant.name}: ${actionLink}`,
      });
    } catch {
      await admin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
      return NextResponse.json({ error: "No se pudo enviar el correo de invitación. Revisa la configuración SMTP e inténtalo de nuevo." }, { status: 502 });
    }
    // Auditoría: quién creó la invitación y si usó el override de superadmin.
    console.info("team.invite.created", JSON.stringify({
      tenantId: input.tenantId,
      email: input.email,
      role: input.role,
      invitedBy: user.email ?? user.id,
      viaSuperadminOverride: member === null,
    }));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo enviar la invitación." : "No autorizado." }, { status });
  }
}
