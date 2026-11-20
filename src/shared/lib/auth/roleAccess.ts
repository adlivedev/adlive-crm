const AGENT_ALLOWED_ROOTS = ["/dashboard", "/contactos", "/conversaciones", "/oportunidades", "/plantillas"] as const;

export function canAgentAccessPath(pathname: string): boolean {
  return AGENT_ALLOWED_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

type WorkspaceRole = "owner" | "admin" | "agent" | null;

export function assignedMemberForView(role: WorkspaceRole, memberId: string | null, viewingAsMemberId: string | null): string | null {
  return viewingAsMemberId ?? (role === "agent" ? memberId : null);
}

export function contactMemberForView(role: WorkspaceRole, memberId: string | null, canViewAll: boolean | null, viewingAsMemberId: string | null): string | null {
  return viewingAsMemberId ?? (role === "agent" && !canViewAll ? memberId : null);
}
