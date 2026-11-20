import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ingest: vi.fn(), after: vi.fn(), bot: vi.fn(), getIntegration: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/shared/services/aiBotService", () => ({ processAiBotReply: mocks.bot }));
vi.mock("@/shared/services/tenantIntegrationService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/tenantIntegrationService")>(), getTenantIntegration: mocks.getIntegration,
}));
vi.mock("@/shared/services/whatsappWebhookService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/whatsappWebhookService")>(), ingestWhatsAppPayload: mocks.ingest,
}));

import { GET, POST } from "@/app/api/v1/[tenantId]/[provider]/webhooks/route";

const secret = "meta-test-secret";
const tenantId = "11111111-1111-4111-8111-111111111111";
const phoneNumberId = "1331700773359404";
const integration = {
  id: "integration-1", tenant_id: tenantId, provider: "whatsapp_cloud_api", is_connected: true,
  public_metadata: { phone_number_id: phoneNumberId }, encrypted_credentials: "encrypted", updated_at: "2026-11-20",
  credentials: { app_secret: secret, verify_token: "tenant-verify-token-123456789012" },
};
const context = { params: Promise.resolve({ tenantId, provider: "whatsapp" }) };

function request(body: string, headers: Record<string, string> = {}) {
  const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
  return new Request(`http://localhost/api/v1/${tenantId}/whatsapp/webhooks`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature, ...headers }, body,
  });
}
function emptyResult() {
  return { received: 0, inserted: 0, statusesUpdated: 0, templatesUpdated: 0, templatesUnmatched: 0,
    templateEventsIgnored: 0, ignoredFields: { calls: 1 }, insertedWaMessageIds: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntegration.mockResolvedValue(integration);
  mocks.ingest.mockResolvedValue(emptyResult());
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("TC-WA-ROUTE — contrato HTTP aislado del webhook", () => {
  it("verifica el challenge con el token individual", async () => {
    const response = await GET(new Request(`http://localhost/api/v1/${tenantId}/whatsapp/webhooks?hub.mode=subscribe&hub.verify_token=${integration.credentials.verify_token}&hub.challenge=challenge-123`), context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-123");
  });

  it("rechaza JSON inválido aunque su firma sea correcta", async () => {
    const response = await POST(request("{"), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "JSON no válido." });
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("rechaza una firma generada con el App Secret de tenantB", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: phoneNumberId }, messages: [],
    } }] }] });
    const tenantBSignature = `sha256=${createHmac("sha256", "tenant-b-app-secret").update(body, "utf8").digest("hex")}`;
    const response = await POST(request(body, { "X-Hub-Signature-256": tenantBSignature }), context);
    expect(response.status).toBe(401);
    expect(mocks.getIntegration).toHaveBeenCalledWith(tenantId, "whatsapp_cloud_api");
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("confirma un evento sin mensajes y difiere su procesamiento", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "calls", value: {} }] }] });
    const response = await POST(request(body), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, accepted: true });
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledOnce();
    const deferred = mocks.after.mock.calls[0]?.[0] as () => Promise<void>;
    await deferred();
    expect(mocks.ingest).toHaveBeenCalledOnce();
  });

  it("devuelve 400 para un campo soportado mal formado antes de confirmarlo", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {} }] }] });
    const response = await POST(request(body), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Contenido del webhook no válido." });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("rechaza una línea que no pertenece al tenant de la URL", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: "otra-linea" }, messages: [],
    } }] }] });
    const response = await POST(request(body), context);
    expect(response.status).toBe(403);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("rechaza por tamaño antes de leer o verificar el cuerpo", async () => {
    const response = await POST(request("{}", { "Content-Length": "3000001" }), context);
    expect(response.status).toBe(413);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
