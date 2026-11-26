import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";

/** QA-NEW-004 — Rate limiting persistente en PostgreSQL (nunca Map en memoria:
 *  Vercel Serverless instancia funciones aisladas y un Map local no limitaría nada).
 *  Devuelve null si el intento está permitido, o los segundos restantes de espera. */
export async function checkServerRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<number | null> {
  const admin = createAdminClient() as unknown as { schema?: (s: string) => { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> } };
  if (typeof admin.schema !== "function") return null;
  const { data, error } = await admin.schema("private").rpc("check_rate_limit", {
    p_key: key.slice(0, 200),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Ante cualquier fallo de la BD no bloqueamos el negocio (fail-open); el
    // intento se registra en logs para observabilidad.
    console.error("[rate-limit] check_rate_limit falló", error.message);
    return null;
  }
  if (data === true) return null;
  return windowSeconds;
}

/** IP del cliente de forma robusta detrás de proxies (Vercel). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim().slice(0, 64) ?? "unknown";
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) ?? "unknown";
}
