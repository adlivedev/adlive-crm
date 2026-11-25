import { describe, expect, it } from "vitest";

import { normalizeCoPhone, requireE164, toE164 } from "@/shared/lib/phone";

describe("normalizeCoPhone — validación estricta Colombia", () => {
  it("acepta móvil de 10 dígitos y lo normaliza a E.164", () => {
    expect(normalizeCoPhone("3001234567")).toEqual({ ok: true, e164: "+573001234567" });
    expect(normalizeCoPhone(" 310 456 7890 ")).toEqual({ ok: true, e164: "+573104567890" });
  });

  it("acepta prefijo de país 57 y +57", () => {
    expect(normalizeCoPhone("573001234567")).toEqual({ ok: true, e164: "+573001234567" });
    expect(normalizeCoPhone("+57 300 123 4567")).toEqual({ ok: true, e164: "+573001234567" });
  });

  it("rechaza vacíos y caracteres no numéricos", () => {
    expect(normalizeCoPhone("").ok).toBe(false);
    expect(normalizeCoPhone(null).ok).toBe(false);
    expect(normalizeCoPhone("30abc4567").ok).toBe(false);
  });

  it("rechaza longitudes inválidas y prefijos no móviles", () => {
    expect(normalizeCoPhone("1234567").ok).toBe(false);      // fijo sin indicativo
    expect(normalizeCoPhone("2001234567").ok).toBe(false);   // 200 no es móvil CO
    expect(normalizeCoPhone("300123456").ok).toBe(false);    // corto
    expect(normalizeCoPhone("30012345678").ok).toBe(false);  // largo
  });

  it("toE164 y requireE164 envuelven el resultado", () => {
    expect(toE164("3015551234")).toBe("+573015551234");
    expect(toE164("123")).toBeNull();
    expect(requireE164("3229998888")).toBe("+573229998888");
    expect(() => requireE164("12")).toThrow();
  });
});
