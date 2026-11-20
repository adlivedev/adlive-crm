import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getIntegration: vi.fn(), ingest: vi.fn(), after: vi.fn(), bot: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/shared/services/aiBotService", () => ({ processAiBotReply: mocks.bot }));
vi.mock("@/shared/services/tenantIntegrationService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/tenantIntegrationService")>(), getTenantIntegration: mocks.getIntegration,
}));
vi.mock("@/shared/services/whatsappWebhookService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/whatsappWebhookService")>(), ingestWhatsAppPayload: mocks.ingest,
}));

import { POST } from "@/app/api/v1/[tenantId]/[provider]/webhooks/route";
import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";

const secret = "meta-test-secret";
const tenantId = "11111111-1111-4111-8111-111111111111";
const integration = {
  id: "integration-1", tenant_id: tenantId, provider: "whatsapp_cloud_api", is_connected: true,
  public_metadata: { phone_number_id: "123456789" }, encrypted_credentials: "encrypted", updated_at: "2026-11-20",
  credentials: { app_secret: secret, verify_token: "tenant-verify-token-123456789012" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntegration.mockResolvedValue(integration);
});

describe("TC-006 / TC-007 — firma del webhook de Meta", () => {
  it("acepta la firma HMAC-SHA256 del cuerpo original", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
    expect(isValidMetaSignature(body, signature, secret)).toBe(true);
  });

  it.each([null, "sha256=invalida", "sha1=abcd", "sha256="])("rechaza una firma inválida: %s", (signature) => {
    expect(isValidMetaSignature("{}", signature, secret)).toBe(false);
  });

  it("TC-006: valida con el app_secret descifrado del tenant antes de ingestar", async () => {
    const request = new Request(`http://localhost/api/v1/${tenantId}/whatsapp/webhooks`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=invalida" },
      body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
    });
    const response = await POST(request, { params: Promise.resolve({ tenantId, provider: "whatsapp" }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Firma no válida." });
    expect(mocks.getIntegration).toHaveBeenCalledWith(tenantId, "whatsapp_cloud_api");
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("usa comparación segura solo cuando las longitudes coinciden", () => {
    expect(safeEqualSecret("mismo-token", "mismo-token")).toBe(true);
    expect(safeEqualSecret("token-a", "token-b")).toBe(false);
    expect(safeEqualSecret("corto", "mucho-mas-largo")).toBe(false);
  });
});
