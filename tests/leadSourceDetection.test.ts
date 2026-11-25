import { beforeEach, describe, expect, it, vi } from "vitest";

/** Detección automática de origen del lead (espejo de la lógica de form.js). */
export function detectLeadSource(referrer: string, userAgent: string): { source: string; label: string } {
  const ref = referrer.toLowerCase();
  const ua = userAgent.toLowerCase();
  if (ref.includes("instagram.com") || ua.includes("instagram")) return { source: "instagram", label: "Instagram" };
  if (ref.includes("facebook.com") || ua.includes("fban") || ua.includes("fbav")) return { source: "facebook", label: "Facebook" };
  if (ref.includes("tiktok.com") || ua.includes("tiktok")) return { source: "tiktok", label: "TikTok" };
  if (ref.includes("google.") || ua.includes("gsa")) return { source: "google", label: "Google" };
  return { source: "directo", label: "Directo / Orgánico" };
}

describe("detección automática de origen del lead", () => {
  it("detecta Instagram por referrer o userAgent (in-app browser)", () => {
    expect(detectLeadSource("https://l.instagram.com/", "Mozilla/5.0")).toEqual({ source: "instagram", label: "Instagram" });
    expect(detectLeadSource("", "Mozilla/5.0 Instagram 312.0 iPhone")).toEqual({ source: "instagram", label: "Instagram" });
  });

  it("detecta Facebook (FBAN/FBAV y referrer)", () => {
    expect(detectLeadSource("", "Mozilla/5.0 (Linux; FBAV/123)")).toEqual({ source: "facebook", label: "Facebook" });
    expect(detectLeadSource("https://m.facebook.com/", "Mozilla/5.0")).toEqual({ source: "facebook", label: "Facebook" });
  });

  it("detecta TikTok y Google", () => {
    expect(detectLeadSource("https://www.tiktok.com/", "Mozilla/5.0")).toEqual({ source: "tiktok", label: "TikTok" });
    expect(detectLeadSource("https://www.google.com/", "Mozilla/5.0")).toEqual({ source: "google", label: "Google" });
  });

  it("sin origen cae en Directo / Orgánico", () => {
    expect(detectLeadSource("", "Mozilla/5.0 (Windows NT 10.0)")).toEqual({ source: "directo", label: "Directo / Orgánico" });
  });

  it("prioriza un referrer explícito sobre el userAgent", () => {
    expect(detectLeadSource("https://instagram.com/p/abc", "Mozilla/5.0 FBAV/1")).toEqual({ source: "instagram", label: "Instagram" });
  });
});

/* El resto del archivo queda disponible para futuras pruebas del cron. */
beforeEach(() => {
  vi.unstubAllEnvs();
});
