import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), decrypt: vi.fn(), ingest: vi.fn(), after: vi.fn(), bot: vi.fn(), filter: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({ decryptVaultCredentials: mocks.decrypt }));
vi.mock("@/shared/services/aiBotService", () => ({ processAiBotReply: mocks.bot }));
vi.mock("@/shared/services/whatsappWebhookService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/whatsappWebhookService")>(), ingestWhatsAppPayload: mocks.ingest,
}));

import { GET, POST } from "@/app/api/v1/webhooks/whatsapp/route";

const secret = "legacy-tenant-secret";
const tenantId = "11111111-1111-4111-8111-111111111111";
const phoneNumberId = "123456789012345";
const record = {
  id: "integration-1", tenant_id: tenantId, provider: "whatsapp_cloud_api", is_connected: true,
  public_metadata: { phone_number_id: phoneNumberId }, encrypted_credentials: "encrypted", updated_at: "2026-11-20",
};

beforeEach(() => {
  vi.clearAllMocks();
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: vi.fn(() => query), eq: vi.fn(() => query),
    filter: mocks.filter.mockImplementation(() => query),
    limit: vi.fn(async () => ({ data: [record], error: null })),
  });
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
  mocks.decrypt.mockReturnValue({ app_secret: secret, verify_token: "legacy-token-12345678901234567890" });
  mocks.ingest.mockResolvedValue({ received: 0, inserted: 0, statusesUpdated: 0, templatesUpdated: 0,
    templatesUnmatched: 0, templateEventsIgnored: 0, ignoredFields: {}, insertedWaMessageIds: [] });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Webhook WhatsApp legacy sin variables globales", () => {
  it("resuelve el tenant por Phone Number ID y valida su app_secret", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: phoneNumberId }, messages: [],
    } }] }] });
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const response = await POST(new Request("http://localhost/api/v1/webhooks/whatsapp", {
      method: "POST", headers: { "X-Hub-Signature-256": signature }, body,
    }));
    expect(response.status).toBe(200);
    expect(mocks.filter).toHaveBeenCalledWith("public_metadata->>phone_number_id", "in", `(${phoneNumberId})`);
  });

  it("rechaza una firma que no coincide con la bóveda resuelta", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: phoneNumberId }, messages: [],
    } }] }] });
    const response = await POST(new Request("http://localhost/api/v1/webhooks/whatsapp", {
      method: "POST", headers: { "X-Hub-Signature-256": "sha256=invalida" }, body,
    }));
    expect(response.status).toBe(401);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("mantiene la verificación GET comparando tokens individuales", async () => {
    const response = await GET(new Request("http://localhost/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=legacy-token-12345678901234567890&hub.challenge=legacy-challenge"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("legacy-challenge");
  });
});
