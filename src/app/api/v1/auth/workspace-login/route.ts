import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_TENANT_COOKIE, evaluateWorkspaceAccess } from "@/shared/lib/auth/workspaceAccess";
import { checkServerRateLimit, clientIp } from "@/shared/lib/rateLimit";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type { Tenant } from "@/shared/types/database";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
  workspaceSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150).nullable().optional(),
});

function responseWithTenant(body: Record<string, unknown>, tenantId?: string, status = 200, extraHeaders: Record<string, string> = {}) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
  if (tenantId) {
    response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
      path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    response.cookies.set(ACTIVE_TENANT_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return responseWithTenant({ error: "Revisa el correo, la contraseña y el workspace." }, undefined, 400);

  /* QA-NEW-004: máx. 5 intentos por minuto por IP + correo (anti fuerza bruta). */
  const retryAfter = await checkServerRateLimit(`login:${clientIp(request)}:${parsed.data.email}`, 5, 60);
  if (retryAfter !== null) {
    return responseWithTenant({ error: "Demasiados intentos de acceso. Espera un minuto e inténtalo de nuevo." }, undefined, 429, { "Retry-After": String(retryAfter) });
  }

  const supabase = await createClient();
  let sessionStarted = false;
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (authError || !authData.user) {
      return responseWithTenant({ error: "El correo o la contraseña no son válidos." }, undefined, 401);
    }
    sessionStarted = true;

    const admin = createAdminClient();
    const workspaceSlug = parsed.data.workspaceSlug || null;
    const superadminResult = await admin.from("platform_superadmins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    const isPlatformSuperadmin = !superadminResult.error && Boolean(superadminResult.data);

    if (!isPlatformSuperadmin && !workspaceSlug) {
      await supabase.auth.signOut({ scope: "global" });
      return responseWithTenant({ error: "Acceso denegado: debes iniciar sesión desde el enlace exclusivo de tu empresa." }, undefined, 403);
    }

    const tenantResult = await admin.from("tenants")
      .select("id,name,slug,branding,status,created_at,updated_at")
      .eq("slug", workspaceSlug ?? "adlive").maybeSingle();
    const workspace = tenantResult.data as Tenant | null;

    let hasActiveMembership = false;
    if (workspace && !isPlatformSuperadmin) {
      const memberResult = await admin.from("tenant_members").select("id").eq("tenant_id", workspace.id)
        .eq("user_id", authData.user.id).eq("is_active", true).limit(1).maybeSingle();
      hasActiveMembership = Boolean(memberResult.data && !memberResult.error);
    }

    const decision = evaluateWorkspaceAccess({
      isPlatformSuperadmin, workspaceSlug, workspace, hasActiveMembership,
    });
    if (!decision.allowed) {
      await supabase.auth.signOut({ scope: "global" });
      return responseWithTenant({ error: decision.message }, undefined, decision.reason === "not_found" ? 404 : 403);
    }

    return responseWithTenant({
      ok: true,
      email: authData.user.email?.toLowerCase(),
      tenantId: workspace!.id,
    }, workspace!.id);
  } catch {
    if (sessionStarted) await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
    return responseWithTenant({ error: "No se pudo validar el acceso. Inténtalo de nuevo." }, undefined, 500);
  }
}
