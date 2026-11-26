import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkServerRateLimit: vi.fn(),
  clientIp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/shared/lib/rateLimit", () => ({
  checkServerRateLimit: mocks.checkServerRateLimit,
  clientIp: mocks.clientIp,
}));
vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST as workspaceLogin } from "@/app/api/v1/auth/workspace-login/route";

/** Cadena flexible: cualquier combinación de .eq(...) devuelve un objeto con
 *  maybeSingle resoluble (las consultas del login encadenan 1-3 eq). */
function adminStub(row: unknown) {
  const chain: Record<string, unknown> = {};
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: row, error: null });
  chain.limit = () => chain;
  return {
    auth: {},
    from: () => ({ select: () => chain }),
  };
}

function loginReq() {
  return new Request("http://localhost/api/v1/auth/workspace-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@b.co", password: "x123456", workspaceSlug: "cierto" }),
  });
}

describe("TC-RATE-LIMIT-LOGIN — QA-NEW-004: 429 en workspace-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkServerRateLimit.mockResolvedValue(null);
    mocks.clientIp.mockReturnValue("1.2.3.4");
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut } });
    mocks.createAdminClient.mockReturnValue(adminStub(null));
  });

  it("rate limit activo → 429 con Retry-After y NO intenta el sign-in", async () => {
    mocks.checkServerRateLimit.mockResolvedValue(120);
    const response = await workspaceLogin(loginReq());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.checkServerRateLimit).toHaveBeenCalledWith("login:1.2.3.4:a@b.co", 5, 60);
  });

  it("rate limit permite → continúa con el login (no 429)", async () => {
    const response = await workspaceLogin(loginReq());
    expect(response.status).not.toBe(429);
    expect(response.status).not.toBe(400);
    expect(mocks.signInWithPassword).toHaveBeenCalled();
  });
});
