import { describe, expect, it } from "vitest";

import { nextRetryRunAfter, retryDelayMinutes } from "@/shared/lib/backgroundJobs";

describe("cola background_jobs — política de reintentos", () => {
  it("backoff lineal: 1 min, 2 min, 3 min…", () => {
    expect(retryDelayMinutes(1)).toBe(1);
    expect(retryDelayMinutes(2)).toBe(2);
    expect(retryDelayMinutes(3)).toBe(3);
  });

  it("tope de 5 minutos en reintentos altos", () => {
    expect(retryDelayMinutes(10)).toBe(5);
    expect(retryDelayMinutes(99)).toBe(5);
  });

  it("nunca programa en el pasado: mínimo 1 minuto", () => {
    expect(retryDelayMinutes(0)).toBe(1);
    expect(retryDelayMinutes(-3)).toBe(1);
  });

  it("nextRetryRunAfter suma el retraso al momento dado", () => {
    const from = new Date("2026-11-25T12:00:00.000Z");
    expect(nextRetryRunAfter(2, from)).toBe("2026-11-25T12:02:00.000Z");
    expect(nextRetryRunAfter(10, from)).toBe("2026-11-25T12:05:00.000Z");
  });
});
