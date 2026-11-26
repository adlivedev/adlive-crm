import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  decryptVaultCredentials: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({ decryptVaultCredentials: mocks.decryptVaultCredentials }));

import { testProviderConnection } from "@/shared/services/aiBotService";

const tenantId = "11111111-1111-4111-8111-111111111111";

function adminWithVaultRow() {
  return {
    from: (table: string) => {
      if (table !== "tenant_integrations_vault") throw new Error(`Tabla no esperada: ${table}`);
      return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { encrypted_credentials: "cifrado" }, error: null }) }) }) }) }),
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue(adminWithVaultRow());
  mocks.decryptVaultCredentials.mockReturnValue({ api_key: "AIza-test-key" });
});

describe("TC-AI-PROVIDER-FALLBACK — QA-NEW-007: testProviderConnection recorre la cadena", () => {
  it("si el primer modelo responde 404, prueba el siguiente y reporta éxito con ese modelo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("gemini-2.5-flash:")) {
        return new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 });
      }
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "OK" }] } }],
        usageMetadata: { totalTokenCount: 4 },
      }), { status: 200 });
    });

    const result = await testProviderConnection("gemini", tenantId);

    expect(result.ok).toBe(true);
    expect(result.model).toBe("gemini-flash-latest");
    expect(result.message).toContain("gemini-flash-latest");
    /* Se intentaron 2 modelos: el primero 404 y el segundo OK. */
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("gemini-2.5-flash");
  });

  it("si todos los modelos dan 404, devuelve http_error con la cadena completa en el diagnóstico", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }),
    );

    const result = await testProviderConnection("gemini", tenantId);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("http_error");
    expect(result.httpStatus).toBe(404);
    expect(result.message).toContain("gemini-2.5-flash");
    expect(result.message).toContain("gemini-flash-latest");
  });

  it("401 rechaza la clave directamente sin recorrer la cadena", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401 }),
    );

    const result = await testProviderConnection("gemini", tenantId);

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.message).toContain("rechazó la clave");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin fila en el vault devuelve no_key sin llamar al proveedor", async () => {
    mocks.createAdminClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await testProviderConnection("gemini", tenantId);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("no_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
