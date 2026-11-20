import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getIntegration: vi.fn(), admin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/shared/lib/appOrigin", () => ({ getAppOrigin: () => "https://crm.test" }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/shared/services/tenantIntegrationService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/services/tenantIntegrationService")>(), getTenantIntegration: mocks.getIntegration,
}));

import { POST } from "@/app/api/v1/[tenantId]/[provider]/webhooks/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const authToken = "twilio-tenant-auth-token";
const accountSid = "AC123456789";
const integration = {
  id: "integration-1", tenant_id: tenantId, provider: "twilio", is_connected: true,
  public_metadata: { account_sid: accountSid }, encrypted_credentials: "encrypted", updated_at: "2026-11-20",
  credentials: { auth_token: authToken },
};
const context = { params: Promise.resolve({ tenantId, provider: "twilio" }) };
const publicUrl = `https://crm.test/api/v1/${tenantId}/twilio/webhooks`;

function signedRequest(params: URLSearchParams) {
  const signed = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
    .reduce((value, [key, item]) => value + key + item, publicUrl);
  const signature = createHmac("sha1", authToken).update(signed).digest("base64");
  return new Request(`http://localhost/api/v1/${tenantId}/twilio/webhooks`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signature },
    body: params.toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntegration.mockResolvedValue(integration);
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [{
    out_contact_id: "22222222-2222-4222-8222-222222222222", out_assigned_member_id: null,
  }], error: null });
});

describe("Adaptador Twilio aislado", () => {
  it("valida la firma nativa y registra el mensaje en el tenant de la URL", async () => {
    const params = new URLSearchParams({ MessageSid: "SM123", AccountSid: accountSid, From: "+573201234567", Body: "Hola", ProfileName: "Juan" });
    const response = await POST(signedRequest(params), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("ingest_tenant_lead", expect.objectContaining({
      p_tenant_id: tenantId, p_provider: "twilio", p_event_id: "SM123", p_phone_e164: "+573201234567", p_message: "Hola",
    }));
  });

  it("rechaza un AccountSid de otra empresa antes de escribir", async () => {
    const params = new URLSearchParams({ MessageSid: "SM999", AccountSid: "AC_OTRA_EMPRESA", From: "+573201234567", Body: "No mezclar" });
    const response = await POST(signedRequest(params), context);
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
