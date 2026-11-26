export const ACTIVE_TENANT_COOKIE = "crm-active-tenant";
export const EXCLUSIVE_WORKSPACE_ERROR = "Acceso denegado: debes iniciar sesión desde el enlace exclusivo de tu empresa.";
export const SUSPENDED_WORKSPACE_ERROR = "El espacio de trabajo está inhabilitado. Contacta al administrador.";

export interface WorkspaceAccessTenant {
  id: string;
  slug: string;
  status?: "active" | "suspended";
}

export type WorkspaceAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "exclusive" | "suspended" | "not_found"; message: string };

/** Regla única para login y recuperación; no sustituye la autenticación de Supabase. */
export function evaluateWorkspaceAccess(input: {
  isPlatformSuperadmin: boolean;
  workspaceSlug: string | null;
  workspace: WorkspaceAccessTenant | null;
  hasActiveMembership: boolean;
}): WorkspaceAccessDecision {
  if (!input.workspace) {
    return { allowed: false, reason: "not_found", message: "El espacio de trabajo no existe o no está disponible." };
  }
  if (input.isPlatformSuperadmin) return { allowed: true };
  if (!input.workspaceSlug || input.workspaceSlug !== input.workspace.slug || !input.hasActiveMembership) {
    return { allowed: false, reason: "exclusive", message: EXCLUSIVE_WORKSPACE_ERROR };
  }
  if (input.workspace.status === "suspended") {
    return { allowed: false, reason: "suspended", message: SUSPENDED_WORKSPACE_ERROR };
  }
  return { allowed: true };
}

/** QA-NEW-005 — Destino del logout: un usuario de workspace cliente debe
 *  aterrizar siempre en /login?workspace=<slug>; el superadmin va al login
 *  genérico. */
export function resolveLogoutLoginPath(isPlatformSuperadmin: boolean, tenantSlug: string | null | undefined): string {
  return !isPlatformSuperadmin && tenantSlug
    ? `/login?workspace=${encodeURIComponent(tenantSlug)}`
    : "/login";
}
