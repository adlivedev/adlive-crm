import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireTenantAdmin } from "@/shared/lib/serverAuth";
import { brandingSchema } from "@/shared/lib/validation/branding";

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  branding: brandingSchema,
});

export async function PATCH(request: Request) {
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Configuración de marca inválida." }, { status: 400 });

    const { supabase } = await requireTenantAdmin(parsed.data.tenantId);
    const { data, error } = await supabase
      .from("tenants")
      .update({ branding: parsed.data.branding })
      .eq("id", parsed.data.tenantId)
      .select("id, branding")
      .single();

    if (error) return NextResponse.json({ error: "No se pudo guardar la marca." }, { status: 500 });
    return NextResponse.json({ tenant: data });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo guardar la marca." : "No autorizado." }, { status });
  }
}
