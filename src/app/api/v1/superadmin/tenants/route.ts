import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
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

export async function GET() {
  try {
    const { supabase } = await requirePlatformSuperadmin();
    const { data, error } = await supabase.rpc("get_platform_tenant_metrics");
    if (error) return NextResponse.json({ error: "No se pudieron cargar los workspaces." }, { status: 500 });
    return NextResponse.json({ tenants: data ?? [] });
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
    const authResult = input.temporaryPassword
      ? await admin.auth.admin.createUser({
          email: input.adminEmail,
          password: input.temporaryPassword,
          email_confirm: true,
        })
      : await admin.auth.admin.inviteUserByEmail(input.adminEmail, {
          redirectTo: `${appUrl}/login?workspace=${input.slug}`,
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

    if (error) {
      await admin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json({ error: "No se pudo aprovisionar el workspace. Revisa que el slug sea único." }, { status: 400 });
    }

    return NextResponse.json({
      tenantId,
      loginPath: `/login?workspace=${input.slug}`,
      access: input.temporaryPassword ? "temporary_password" : "email_invitation",
    }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo crear el workspace." : "No autorizado." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformSuperadmin();
    const parsed = z.object({
      tenantId: z.string().uuid(),
      status: z.enum(["active", "suspended"]),
    }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from("tenants").update({ status: parsed.data.status }).eq("id", parsed.data.tenantId);
    if (error) return NextResponse.json({ error: "No se pudo actualizar el workspace." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "No autorizado." }, { status: authErrorStatus(error) });
  }
}
