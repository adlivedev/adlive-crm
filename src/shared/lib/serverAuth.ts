import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/shared/lib/supabase/server";
import type { TenantMember } from "@/shared/types/database";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  return { supabase, user };
}

export async function requirePlatformSuperadmin(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: User }> {
  const context = await requireUser();
  const { data, error } = await context.supabase.rpc("is_platform_superadmin");
  if (error || data !== true) throw new Error("FORBIDDEN");
  return context;
}

export async function requireTenantMember(tenantId: string) {
  const context = await requireUser();
  const { data: member, error } = await context.supabase
    .from("tenant_members").select("*").eq("tenant_id", tenantId)
    .eq("user_id", context.user.id).eq("is_active", true).maybeSingle();
  if (error || !member) throw new Error("FORBIDDEN");
  return { ...context, member: member as TenantMember };
}

/** Miembro activo o superadmin de plataforma para lecturas de servidor. */
export async function requireTenantMemberOrPlatformSuperadmin(tenantId: string) {
  const context = await requireUser();
  const { data: isSuperadmin, error: superadminError } = await context.supabase.rpc("is_platform_superadmin");
  if (!superadminError && isSuperadmin === true) return { ...context, member: null };

  const { data: member, error } = await context.supabase
    .from("tenant_members").select("*").eq("tenant_id", tenantId)
    .eq("user_id", context.user.id).eq("is_active", true).maybeSingle();
  if (error || !member) throw new Error("FORBIDDEN");
  return { ...context, member: member as TenantMember };
}

export async function requireTenantAdmin(tenantId: string) {
  const context = await requireUser();
  const { data: member, error } = await context.supabase
    .from("tenant_members")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", context.user.id)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (error || !member) throw new Error("FORBIDDEN");
  return { ...context, member: member as TenantMember };
}

/** Owner/admin del tenant o superadmin, sin convertirlo en dueño de clientes. */
export async function requireTenantAdminOrPlatformSuperadmin(tenantId: string) {
  const context = await requireUser();
  const { data: isSuperadmin, error: superadminError } = await context.supabase.rpc("is_platform_superadmin");
  if (!superadminError && isSuperadmin === true) return { ...context, member: null };

  const { data: member, error } = await context.supabase
    .from("tenant_members")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", context.user.id)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (error || !member) throw new Error("FORBIDDEN");
  return { ...context, member: member as TenantMember };
}

export function authErrorStatus(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHORIZED") return 401;
  if (code === "FORBIDDEN") return 403;
  return 500;
}
