import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { IntegrationProvider } from "@/shared/types/database";

export const integrationProviderSchema = z.enum([
  "whatsapp_cloud_api", "facebook_lead_ads", "instagram", "tiktok_ads", "twilio", "telnyx",
]);
export const webhookProviderSchema = z.enum(["whatsapp", "facebook-leads", "instagram", "tiktok-ads", "twilio", "telnyx"]);
export type WebhookProvider = z.infer<typeof webhookProviderSchema>;

export const WEBHOOK_VAULT_PROVIDERS: Record<WebhookProvider, IntegrationProvider> = {
  whatsapp: "whatsapp_cloud_api",
  "facebook-leads": "facebook_lead_ads",
  instagram: "instagram",
  "tiktok-ads": "tiktok_ads",
  twilio: "twilio",
  telnyx: "telnyx",
};

export interface TenantIntegrationRecord {
  id: string;
  tenant_id: string;
  provider: IntegrationProvider;
  is_connected: boolean;
  public_metadata: Record<string, string>;
  encrypted_credentials: string;
  updated_at: string;
}

export interface ResolvedTenantIntegration extends TenantIntegrationRecord {
  credentials: Record<string, string>;
}

type AdminClient = ReturnType<typeof createAdminClient>;

export function generateVerifyToken(): string {
  return randomBytes(16).toString("hex");
}

export async function getTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider,
  admin: AdminClient = createAdminClient(),
  requireConnected = true,
): Promise<ResolvedTenantIntegration | null> {
  let query = admin.from("tenant_integrations_vault")
    .select("id,tenant_id,provider,is_connected,public_metadata,encrypted_credentials,updated_at")
    .eq("tenant_id", tenantId).eq("provider", provider);
  if (requireConnected) query = query.eq("is_connected", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const record = data as TenantIntegrationRecord;
  return {
    ...record,
    public_metadata: record.public_metadata ?? {},
    credentials: decryptVaultCredentials(record.encrypted_credentials, tenantId, provider),
  };
}

export function credential(integration: ResolvedTenantIntegration, key: string): string {
  return integration.credentials[key]?.trim() ?? "";
}

export function publicCredential(integration: ResolvedTenantIntegration, key: string): string {
  const value = integration.public_metadata[key];
  return typeof value === "string" ? value.trim() : "";
}
