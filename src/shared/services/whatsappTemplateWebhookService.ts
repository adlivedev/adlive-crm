import "server-only";

import { z } from "zod";

import type { createAdminClient } from "@/shared/lib/supabase/admin";
import type { WhatsAppTemplateStatus } from "@/shared/types/database";

const templateIdSchema = z.union([
  z.string().regex(/^\d{1,40}$/),
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
]).transform(String);

export const templateStatusValueSchema = z.object({
  event: z.string().trim().min(1).max(64),
  message_template_id: templateIdSchema,
  message_template_name: z.string().min(1).max(150),
  message_template_language: z.string().min(2).max(20),
  reason: z.string().max(300).nullable().optional(),
  rejection_info: z.object({
    reason: z.string().max(500).optional(),
    recommendation: z.string().max(500).optional(),
  }).passthrough().optional(),
  other_info: z.object({
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
  }).passthrough().optional(),
}).passthrough();

export interface TemplateStatusChange {
  wabaId: string | null;
  value: z.infer<typeof templateStatusValueSchema>;
}

const eventStatuses: Record<string, WhatsAppTemplateStatus> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  DISABLED: "DISABLED",
  PAUSED: "PAUSED",
  FLAGGED: "FLAGGED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
  PENDING_DELETION: "PENDING_DELETION",
  IN_APPEAL: "IN_APPEAL",
  LOCKED: "LOCKED",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  REINSTATED: "APPROVED",
};

function rejectionReason(value: TemplateStatusChange["value"], status: WhatsAppTemplateStatus): string {
  if (status === "APPROVED") return "NONE";
  const detail = value.rejection_info
    ? [value.rejection_info.reason, value.rejection_info.recommendation].filter(Boolean).join(" Recomendación: ")
    : "";
  const reason = value.reason && value.reason !== "NONE" ? value.reason : value.other_info?.title ?? value.reason;
  return [reason, detail].filter(Boolean).join(" — ").slice(0, 1000) || "NONE";
}

/** Actualiza solo plantillas existentes: el evento no contiene el cuerpo necesario para crear una. */
export async function processTemplateStatusChanges(
  changes: TemplateStatusChange[],
  admin: ReturnType<typeof createAdminClient>,
  expectedTenantId?: string,
): Promise<{ templatesUpdated: number; templatesUnmatched: number; templateEventsIgnored: number }> {
  let templatesUpdated = 0;
  let templatesUnmatched = 0;
  let templateEventsIgnored = 0;

  for (const change of changes) {
    const status = eventStatuses[change.value.event];
    if (!status) {
      templateEventsIgnored += 1;
      continue;
    }
    if (!change.wabaId) {
      templatesUnmatched += 1;
      continue;
    }

    let integrationQuery = admin.from("tenant_integrations_vault")
      .select("tenant_id").eq("provider", "whatsapp_cloud_api").eq("is_connected", true)
      .filter("public_metadata->>waba_id", "eq", change.wabaId);
    if (expectedTenantId) integrationQuery = integrationQuery.eq("tenant_id", expectedTenantId);
    const { data: integration, error: integrationError } = await integrationQuery
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration) {
      templatesUnmatched += 1;
      continue;
    }

    const { data, error } = await admin.from("whatsapp_templates")
      .update({
        status,
        rejection_reason: rejectionReason(change.value, status),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", integration.tenant_id)
      .eq("meta_template_id", change.value.message_template_id)
      .eq("language", change.value.message_template_language)
      .select("id");
    if (error) throw error;
    if (data?.length) templatesUpdated += data.length;
    else templatesUnmatched += 1;
  }

  return { templatesUpdated, templatesUnmatched, templateEventsIgnored };
}
