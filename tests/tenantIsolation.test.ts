import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantAdminOrPlatformSuperadmin: vi.fn(),
  requireTenantAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  encryptVaultCredentials: vi.fn(),
}));

vi.mock("@/shared/lib/serverAuth", () => ({
  requireTenantAdminOrPlatformSuperadmin: mocks.requireTenantAdminOrPlatformSuperadmin,
  requireTenantAdmin: mocks.requireTenantAdmin,
  authErrorStatus: (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    return code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500;
  },
}));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({ encryptVaultCredentials: mocks.encryptVaultCredentials }));

import { GET, PUT } from "@/app/api/v1/integrations/route";

const tenantId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mocks.requireTenantAdminOrPlatformSuperadmin.mockRejectedValue(new Error("FORBIDDEN"));
  mocks.requireTenantAdmin.mockRejectedValue(new Error("FORBIDDEN"));
});

describe("TC-002 — autorización de integraciones por tenant", () => {
  it("GET devuelve 403 a quien no es miembro y no abre el cliente administrativo", async () => {
    const response = await GET(new Request(`http://localhost/api/v1/integrations?tenantId=${tenantId}`));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No autorizado." });
    expect(mocks.requireTenantAdminOrPlatformSuperadmin).toHaveBeenCalledWith(tenantId);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("PUT devuelve 403 a quien no es owner/admin y no cifra ni escribe credenciales", async () => {
    const response = await PUT(new Request("http://localhost/api/v1/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        provider: "whatsapp_cloud_api",
        credentials: { phone_number_id: "phone-id", waba_id: "waba-id", access_token: "secret-token" },
      }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No autorizado." });
    expect(mocks.requireTenantAdmin).toHaveBeenCalledWith(tenantId);
    expect(mocks.encryptVaultCredentials).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
