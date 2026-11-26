import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { canAgentAccessPath } from "@/shared/lib/auth/roleAccess";
import { ACTIVE_TENANT_COOKIE } from "@/shared/lib/auth/workspaceAccess";

const PUBLIC_PATHS = new Set(["/login", "/register", "/recuperar-contrasena", "/restablecer-contrasena"]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const passivePublic = pathname.startsWith("/l/") || pathname.startsWith("/embed/")
    || pathname.startsWith("/api/v1/embed/") || /^\/api\/v1\/[0-9a-f-]{36}\/webhooks\/lead-web$/.test(pathname);
  if (passivePublic) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return response;

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
          ...options,
          /* QA-NEW-002: misma endurecimiento que server.ts/client.ts. */
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: Math.min(options.maxAge ?? 28_800, 28_800),
        }));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/v1/webhooks/") || pathname.startsWith("/api/v1/auth/") || pathname === "/api/v1/public/workspace";
  if (!user && !isPublic && (pathname === "/superadmin" || !pathname.startsWith("/api/"))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (user && (pathname === "/login" || pathname === "/register") && !request.nextUrl.searchParams.has("reauth")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  /* QA-NEW-005: redirige a login forzando re-autenticación (evita el rebote de
     la regla anterior para usuarios con sesión pero tenant inválido). */
  const reauthRedirect = () => {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("reauth", "1");
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  };
  const isPlatformSuperadminUser = async () => {
    if (!user) return false;
    const { data } = await supabase.from("platform_superadmins").select("user_id").eq("user_id", user.id).maybeSingle();
    return Boolean(data);
  };

  if (user && !isPublic && !pathname.startsWith("/api/")) {
    const tenantId = request.cookies.get(ACTIVE_TENANT_COOKIE)?.value;
    const membershipsQuery = () => supabase.from("tenant_members").select("role,tenant_id")
      .eq("user_id", user.id).eq("is_active", true).order("created_at");
    let activeMembership: { role: string; tenant_id: string } | null = null;

    if (tenantId) {
      /* Cookie presente: debe corresponder a una membresía activa real. Si no
         coincide, NO se recae en la primera membresía por created_at. */
      const { data } = await membershipsQuery().eq("tenant_id", tenantId).maybeSingle();
      activeMembership = data;
      if (!activeMembership && !(await isPlatformSuperadminUser())) return reauthRedirect();
    } else {
      /* Sin cookie solo es aceptable una única membresía activa (no es adivinar);
         con varias o ninguna se exige re-autenticación para resolver el tenant. */
      const { data: memberships } = await membershipsQuery();
      if (memberships && memberships.length === 1) {
        activeMembership = memberships[0] ?? null;
      } else if (!memberships || memberships.length === 0) {
        if (!(await isPlatformSuperadminUser())) return reauthRedirect();
      } else {
        return reauthRedirect();
      }
    }
    if (activeMembership?.role === "agent" && !canAgentAccessPath(pathname)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brands/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
