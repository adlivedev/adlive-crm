import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppOrigin } from "@/shared/lib/appOrigin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Origen canónico de la aplicación", () => {
  it("usa siempre el dominio canónico en producción, aunque exista una variable antigua", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stale.example.com");
    const request = new Request("https://adlive-crm.vercel.app/api/v1/team/invite");
    expect(getAppOrigin(request)).toBe("https://adlive-crm.vercel.app");
  });

  it("permite configurar el origen local y retira barras finales", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    const request = new Request("http://localhost:3000/api/v1/team/invite");
    expect(getAppOrigin(request)).toBe("http://localhost:3000");
  });

  it("usa el origen de la solicitud local si no hay variable configurada", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const request = new Request("http://127.0.0.1:3000/api/v1/team/invite");
    expect(getAppOrigin(request)).toBe("http://127.0.0.1:3000");
  });
});
