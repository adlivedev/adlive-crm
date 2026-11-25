import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";

interface NotifyInput {
  tenantId: string;
  recipientMemberId?: string | null;
  targetRole?: "owner" | "admin" | "agent" | null;
  type: string;
  title: string;
  body: string;
  actionUrl: string;
  metadata?: Record<string, unknown>;
}

/** Crea una notificación in-app (Realtime la entrega al instante a la campana). */
export async function createNotification(input: NotifyInput): Promise<void> {
  await createAdminClient().from("notifications").insert({
    tenant_id: input.tenantId,
    recipient_member_id: input.recipientMemberId ?? null,
    target_role: input.targetRole ?? null,
    type: input.type,
    title: input.title.slice(0, 180),
    body: input.body.slice(0, 1000),
    action_url: input.actionUrl.slice(0, 255),
    metadata: input.metadata ?? {},
  });
}

/** Nuevo contacto: avisa al dueño y a los admins del workspace. */
export async function notifyContactCreated(input: { tenantId: string; contactId: string; contactName: string; source: string; assignedMemberId?: string | null }) {
  const admin = createAdminClient();
  const { data: members } = await admin.from("tenant_members")
    .select("id,role").eq("tenant_id", input.tenantId).eq("is_active", true)
    .in("role", ["owner", "admin"]);
  for (const member of members ?? []) {
    await createNotification({
      tenantId: input.tenantId,
      recipientMemberId: member.id,
      type: "contact_created",
      title: "Nuevo contacto registrado",
      body: `${input.contactName} llegó por ${input.source}.`,
      actionUrl: `/contactos/${input.contactId}`,
      metadata: { contact_id: input.contactId },
    });
  }
}

/** Lead asignado: avisa directamente al agente. */
export async function notifyLeadAssigned(input: { tenantId: string; contactId: string; contactName: string; memberId: string | null }) {
  if (!input.memberId) return;
  await createNotification({
    tenantId: input.tenantId,
    recipientMemberId: input.memberId,
    type: "lead_assigned",
    title: "Te asignaron un contacto",
    body: `${input.contactName} quedó en tu bandeja para seguimiento.`,
    actionUrl: `/contactos/${input.contactId}`,
    metadata: { contact_id: input.contactId },
  });
}
