import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), encrypt: vi.fn(), decrypt: vi.fn(), requireAdmin: vi.fn(), requireMember: vi.fn(), testConnection: vi.fn(),
}));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({ encryptVaultCredentials: mocks.encrypt, decryptVaultCredentials: mocks.decrypt }));
vi.mock("@/shared/lib/serverAuth", () => ({
  requireTenantAdmin: mocks.requireAdmin, requireTenantAdminOrPlatformSuperadmin: mocks.requireMember,
  authErrorStatus: (error: unknown) => error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500,
}));
vi.mock("@/shared/services/integrationConnectionService", () => ({ testTenantConnection: mocks.testConnection }));

import { GET, PUT } from "@/app/api/v1/integrations/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const record = {
  id: "integration-1", tenant_id: tenantId, provider: "whatsapp_cloud_api", is_connected: true,
  public_metadata: { phone_number_id: "123456789", waba_id: "987654321" },
  encrypted_credentials: "encrypted", updated_at: "2026-11-20",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({}); mocks.requireMember.mockResolvedValue({});
  mocks.encrypt.mockReturnValue("encrypted");
  mocks.decrypt.mockReturnValue({ verify_token: "stored-token-1234567890123456", app_secret: "secret" });
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: vi.fn(() => query), eq: vi.fn(() => query), not: vi.fn(() => query),
    upsert: vi.fn(() => query), update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: record, error: null })),
    then: (onfulfilled: (value: unknown) => unknown, onrejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [record], error: null }).then(onfulfilled, onrejected),
  });
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
});

describe("API de integraciones por tenant", () => {
  it("autogenera un verify_token hexadecimal único de 32 caracteres y lo cifra", async () => {
    const response = await PUT(new Request("http://localhost/api/v1/integrations", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        tenantId, provider: "whatsapp_cloud_api", credentials: {
          phone_number_id: "123456789", waba_id: "987654321", access_token: "token-permanente", app_secret: "app-secret",
        },
      }),
    }));
    expect(response.status).toBe(200);
    const credentials = mocks.encrypt.mock.calls[0]?.[0] as Record<string, string>;
    expect(credentials.verify_token).toMatch(/^[a-f0-9]{32}$/);
    expect(mocks.encrypt).toHaveBeenCalledWith(expect.objectContaining({ app_secret: "app-secret" }), tenantId, "whatsapp_cloud_api");
  });

  it("no expone el token en una lectura ordinaria de miembro", async () => {
    const response = await GET(new Request(`http://localhost/api/v1/integrations?tenantId=${tenantId}`));
    const body = await response.json() as { integrations: Array<Record<string, unknown>> };
    expect(response.status).toBe(200);
    expect(body.integrations[0]).not.toHaveProperty("verify_token");
    expect(body.integrations[0]).not.toHaveProperty("encrypted_credentials");
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.requireMember).toHaveBeenCalledWith(tenantId);
  });

  it("devuelve el token únicamente en la lectura explícita de owner/admin", async () => {
    const response = await GET(new Request(`http://localhost/api/v1/integrations?tenantId=${tenantId}&includeWebhookToken=1`));
    const body = await response.json() as { integrations: Array<{ verify_token?: string }> };
    expect(response.status).toBe(200);
    expect(body.integrations[0]?.verify_token).toBe("stored-token-1234567890123456");
    expect(mocks.requireAdmin).toHaveBeenCalledWith(tenantId);
  });
});
