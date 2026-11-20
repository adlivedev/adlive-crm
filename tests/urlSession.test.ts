import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { establishSessionFromUrl } from "@/shared/lib/supabase/urlSession";

function stubWindow(hash: string) {
  const location = { hash, pathname: "/restablecer-contrasena", search: "?workspace=cierto" };
  const replaceState = vi.fn();
  vi.stubGlobal("window", { location, history: { replaceState } });
  return { replaceState };
}

function fakeSupabase(result: { error: unknown }) {
  const setSession = vi.fn().mockResolvedValue(result);
  const client = { auth: { setSession } } as unknown as SupabaseClient;
  return { client, setSession };
}

describe("establishSessionFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve none cuando la URL no trae tokens ni errores", async () => {
    stubWindow("");
    const { client, setSession } = fakeSupabase({ error: null });
    expect(await establishSessionFromUrl(client)).toBe("none");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("establece la sesión con el flujo implícito y limpia el hash", async () => {
    const { replaceState } = stubWindow("#access_token=abc&refresh_token=def&type=recovery");
    const { client, setSession } = fakeSupabase({ error: null });
    expect(await establishSessionFromUrl(client)).toBe("session");
    expect(setSession).toHaveBeenCalledWith({ access_token: "abc", refresh_token: "def" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/restablecer-contrasena?workspace=cierto");
  });

  it("devuelve error cuando setSession falla (enlace vencido o ya usado)", async () => {
    stubWindow("#access_token=abc&refresh_token=def");
    const { client } = fakeSupabase({ error: new Error("invalid") });
    expect(await establishSessionFromUrl(client)).toBe("error");
  });

  it("devuelve error ante un hash de error de Supabase sin llamar setSession", async () => {
    const { replaceState } = stubWindow("#error=access_denied&error_code=otp_expired");
    const { client, setSession } = fakeSupabase({ error: null });
    expect(await establishSessionFromUrl(client)).toBe("error");
    expect(setSession).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalled();
  });

  it("devuelve error si falta refresh_token en el hash", async () => {
    stubWindow("#access_token=abc");
    const { client, setSession } = fakeSupabase({ error: null });
    expect(await establishSessionFromUrl(client)).toBe("error");
    expect(setSession).not.toHaveBeenCalled();
  });
});
