import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { authErrorStatus, requireTenantAdmin } from "@/shared/lib/serverAuth";
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
    await requireTenantAdmin(input.tenantId);
    const admin = createAdminClient();
    const appUrl = getAppOrigin(request);
    const invited = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo: `${appUrl}/login` });
    if (invited.error || !invited.data.user) {
      return NextResponse.json({ error: "No se pudo invitar al usuario. Verifica el correo." }, { status: 400 });
    }
    const { error } = await admin.from("tenant_members").upsert({
      tenant_id: input.tenantId, user_id: invited.data.user.id, email: input.email, role: input.role,
      is_active: true, can_view_all_contacts: input.role === "admin", presence: "offline",
    }, { onConflict: "tenant_id,email" });
    if (error) return NextResponse.json({ error: "El usuario fue invitado, pero no se pudo guardar su membresía." }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo enviar la invitación." : "No autorizado." }, { status });
  }
}
