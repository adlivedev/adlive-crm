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
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (user && !isPublic && !pathname.startsWith("/api/")) {
    const tenantId = request.cookies.get(ACTIVE_TENANT_COOKIE)?.value;
    let memberQuery = supabase.from("tenant_members").select("role,tenant_id")
      .eq("user_id", user.id).eq("is_active", true);
    if (tenantId) memberQuery = memberQuery.eq("tenant_id", tenantId);
    let memberResult = await memberQuery.order("created_at").limit(1).maybeSingle();
    if ((memberResult.error || !memberResult.data) && tenantId) {
      memberResult = await supabase.from("tenant_members").select("role,tenant_id")
        .eq("user_id", user.id).eq("is_active", true).order("created_at").limit(1).maybeSingle();
    }
    if (memberResult.data?.role === "agent" && !canAgentAccessPath(pathname)) {
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
