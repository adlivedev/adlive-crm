/** Lógica pura de enrutamiento de notificaciones por rol (Fase 2): dado el
 *  equipo del workspace, decide qué miembros reciben una notificación según su
 *  destinatario explícito o su rol. Sin BD, para poder probarla en tests. */

export interface NotificationMember {
  id: string;
  role: "owner" | "admin" | "agent";
  is_active: boolean;
}

export interface NotificationTargetInput {
  /** Destinatario explícito (p. ej. el agente asignado). Tiene prioridad. */
  recipientMemberId?: string | null;
  /** Rol destino cuando no hay destinatario explícito (p. ej. todos los admin). */
  targetRole?: "owner" | "admin" | "agent" | null;
}

export function resolveNotificationTargets(members: NotificationMember[], input: NotificationTargetInput): string[] {
  const active = members.filter((member) => member.is_active);
  if (input.recipientMemberId) {
    const recipient = active.find((member) => member.id === input.recipientMemberId);
    return recipient ? [recipient.id] : [];
  }
  if (input.targetRole === "admin") return active.filter((member) => member.role === "owner" || member.role === "admin").map((member) => member.id);
  if (input.targetRole === "owner") return active.filter((member) => member.role === "owner").map((member) => member.id);
  if (input.targetRole === "agent") return active.filter((member) => member.role === "agent").map((member) => member.id);
  return [];
}
