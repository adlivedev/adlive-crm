import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { sendWorkspaceEmail } from "@/shared/lib/mail/smtpMailer";
import { authErrorStatus, requirePlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { brandingSchema } from "@/shared/lib/validation/branding";

export const runtime = "nodejs";

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150),
  adminEmail: z.string().trim().toLowerCase().email().max(255),
  temporaryPassword: z.string().min(12).max(72).optional(),
  branding: brandingSchema,
});

const updateTenantSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["active", "suspended"]).optional(),
  name: z.string().trim().min(2).max(150).optional(),
  adminEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  branding: brandingSchema.optional(),
}).refine((value) => value.status !== undefined || value.name !== undefined || value.adminEmail !== undefined || value.branding !== undefined, {
  message: "No hay cambios para guardar.",
});

function escapeLink(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  try {
    const { supabase } = await requirePlatformSuperadmin();
    const { data, error } = await supabase.rpc("get_platform_tenant_metrics");
    if (error) return NextResponse.json({ error: "No se pudieron cargar los workspaces." }, { status: 500 });
    return NextResponse.json({ tenants: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "No autorizado." }, { status: authErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformSuperadmin();
    const parsed = createTenantSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del workspace.", issues: parsed.error.flatten() }, { status: 400 });

    const input = parsed.data;
    const admin = createAdminClient();
    const appUrl = getAppOrigin(request);
    const hasTemporaryPassword = Boolean(input.temporaryPassword);
    const authResult = await admin.auth.admin.createUser({
      email: input.adminEmail,
      password: input.temporaryPassword ?? randomBytes(32).toString("base64url"),
      email_confirm: true,
    });

    if (authResult.error || !authResult.data.user) {
      return NextResponse.json({ error: "No se pudo crear o invitar al administrador. Verifica que el correo no esté registrado." }, { status: 400 });
    }

    const authUser = authResult.data.user;
    const { data: tenantId, error } = await admin.rpc("provision_tenant", {
      p_name: input.name,
      p_slug: input.slug,
      p_admin_email: input.adminEmail,
      p_admin_user_id: authUser.id,
      p_branding: input.branding,
    });

    if (error || !tenantId) {
      await admin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json({ error: "No se pudo aprovisionar el workspace. Revisa que el slug sea único." }, { status: 400 });
    }

    const rollbackNewWorkspace = async () => {
      await admin.from("tenants").delete().eq("id", tenantId);
      await admin.auth.admin.deleteUser(authUser.id);
    };

    if (!hasTemporaryPassword) {
      const redirectTo = `${appUrl}/login?workspace=${input.slug}`;
      const linkResult = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: input.adminEmail,
        options: { redirectTo },
      });
      const actionLink = linkResult.data.properties?.action_link;
      if (linkResult.error || !actionLink) {
        await rollbackNewWorkspace();
        return NextResponse.json({ error: "No se pudo generar la invitación. Inténtalo de nuevo." }, { status: 400 });
      }

      try {
        await sendWorkspaceEmail({
          tenantId,
          to: input.adminEmail,
          subject: `Invitación a ${input.name} · ADlive CRM`,
          html: `<p>Has sido invitado como propietario de un nuevo workspace en ADlive CRM.</p><p style="text-align:center;margin:28px 0;"><a href="${escapeLink(actionLink)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-weight:bold;">Aceptar invitación</a></p><p>Si no esperabas esta invitación, puedes ignorar este correo.</p>`,
          text: `Acepta tu invitación a ADlive CRM: ${actionLink}`,
        });
      } catch {
        await rollbackNewWorkspace();
        return NextResponse.json({ error: "No se pudo enviar la invitación por SMTP global. Configura y prueba el correo antes de crear el workspace." }, { status: 502 });
      }
    }

    return NextResponse.json({
      tenantId,
      loginPath: `/login?workspace=${input.slug}`,
      access: hasTemporaryPassword ? "temporary_password" : "email_invitation",
    }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo crear el workspace." : "No autorizado." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformSuperadmin();
    const parsed = updateTenantSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa los cambios del workspace." }, { status: 400 });
    const input = parsed.data;
    const admin = createAdminClient();

    if (input.adminEmail) {
      const ownerResult = await admin.from("tenant_members")
        .select("id,user_id,email")
        .eq("tenant_id", input.tenantId)
        .eq("role", "owner")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (ownerResult.error || !ownerResult.data) return NextResponse.json({ error: "No se encontró el propietario del workspace." }, { status: 404 });

      const owner = ownerResult.data;
      if (owner.email.toLowerCase() !== input.adminEmail) {
        if (owner.user_id) {
          const authUpdate = await admin.auth.admin.updateUserById(owner.user_id, {
            email: input.adminEmail,
            email_confirm: true,
          });
          if (authUpdate.error) return NextResponse.json({ error: "No se pudo actualizar el correo de autenticación del propietario." }, { status: 400 });
        }
        const memberUpdate = await admin.from("tenant_members").update({ email: input.adminEmail }).eq("id", owner.id);
        if (memberUpdate.error) {
          if (owner.user_id) await admin.auth.admin.updateUserById(owner.user_id, { email: owner.email, email_confirm: true });
          return NextResponse.json({ error: "No se pudo actualizar el propietario en el workspace." }, { status: 500 });
        }
      }
    }

    const tenantPatch: { status?: "active" | "suspended"; name?: string; branding?: z.infer<typeof brandingSchema> } = {};
    if (input.status !== undefined) tenantPatch.status = input.status;
    if (input.name !== undefined) tenantPatch.name = input.name;
    if (input.branding !== undefined) tenantPatch.branding = input.branding;
    if (Object.keys(tenantPatch).length > 0) {
      const { error } = await admin.from("tenants").update(tenantPatch).eq("id", input.tenantId);
      if (error) return NextResponse.json({ error: "No se pudo actualizar el workspace." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo actualizar el workspace." : "No autorizado." }, { status });
  }
}
