import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { checkServerRateLimit, clientIp } from "@/shared/lib/rateLimit";

describe("TC-RATE-LIMIT — QA-NEW-004: rate limiting persistente en PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ schema: () => ({ rpc: mocks.rpc }) });
  });

  it("la RPC devuelve true → intento permitido (null)", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(checkServerRateLimit("k", 5, 60)).resolves.toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "k", p_limit: 5, p_window_seconds: 60,
    });
  });

  it("la RPC devuelve false → devuelve windowSeconds (retry)", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(checkServerRateLimit("k", 5, 60)).resolves.toBe(60);
  });

  it("fallo de la RPC → fail-open (null) sin lanzar", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(checkServerRateLimit("k", 5, 60)).resolves.toBeNull();
  });

  it("recorta la clave a 200 chars", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await checkServerRateLimit("x".repeat(300), 5, 60);
    const args = mocks.rpc.mock.calls[0]![1] as { p_key: string };
    expect(args.p_key).toHaveLength(200);
  });

  it("clientIp usa x-forwarded-for (primer valor), recorta a 64 chars y cae a unknown", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
    const long = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "a".repeat(200) },
    });
    expect(clientIp(long)).toHaveLength(64);
    expect(clientIp(new Request("http://localhost/"))).toBe("unknown");
  });
});
