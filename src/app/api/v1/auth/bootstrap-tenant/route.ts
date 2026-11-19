import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const registrationSchema = z.object({
  agencyName: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(12).max(72),
});

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "workspace";
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP !== "true") {
    return NextResponse.json({ error: "El registro público está deshabilitado. Solicita una invitación." }, { status: 403 });
  }
  const parsed = registrationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Usa un nombre válido, un correo válido y una contraseña de 12 a 72 caracteres." }, { status: 400 });
  const input = parsed.data;
  const admin = createAdminClient();
  const appUrl = getAppOrigin(request);
  const authResult = await admin.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: `${appUrl}/login` } });
  if (authResult.error || !authResult.data.user) {
    return NextResponse.json({ error: "No se pudo registrar el usuario. Es posible que el correo ya esté registrado." }, { status: 400 });
  }
  const authUser = authResult.data.user;
  if (authUser.identities?.length === 0) {
    return NextResponse.json({ error: "Este correo ya está registrado. Inicia sesión o recupera tu contraseña." }, { status: 409 });
  }
  const slug = `${slugify(input.agencyName)}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await admin.rpc("provision_tenant", {
    p_name: input.agencyName,
    p_slug: slug,
    p_admin_email: input.email,
    p_admin_user_id: authUser.id,
    p_branding: {
      brand_name: input.agencyName, logo_url: null, logo_dark_url: null,
      primary_color: "#5B00FF", primary_hover: "#4700CC", accent_color: "#29C5F6",
      sidebar_bg: "#0A0A12", canvas_bg: "#F6F7FB", ink_color: "#18181B",
    },
  });
  if (error) {
    await admin.auth.admin.deleteUser(authUser.id);
    return NextResponse.json({ error: "No se pudo aprovisionar el espacio de trabajo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, requiresEmailConfirmation: !authResult.data.session, loginPath: `/login?workspace=${slug}` }, { status: 201 });
}
