/**
 * Seguridad del cron (`/api/v1/cron/process-jobs` y pg_cron de Supabase).
 * - Autorización con comparación en tiempo constante (timingSafeEqual) para
 *   no filtrar el `CRON_SECRET` por tiempos de respuesta.
 * - Partición de jobs de `background_jobs` según el estado del tenant: solo
 *   los jobs de workspaces activos se ejecutan; los `suspended` quedan
 *   pendientes y nunca se procesan.
 * Lógica pura (sin I/O) para poder probarla en tests.
 */

import { timingSafeEqual } from "node:crypto";

/** Valida `Authorization: Bearer <token>` contra el secreto esperado en tiempo constante. */
export function isCronAuthorized(authHeader: string | null, expectedSecret: string | null | undefined): boolean {
  if (!expectedSecret || !authHeader) return false;
  const match = /^Bearer\s+(.+)$/.exec(authHeader.trim());
  if (!match) return false;
  const token = Buffer.from(match[1]!);
  const expected = Buffer.from(expectedSecret);
  return token.length === expected.length && timingSafeEqual(token, expected);
}

/** Separa los jobs ejecutables (tenant activo) de los omitidos (tenant inactivo/suspendido). */
export function partitionJobsByActiveTenants<T extends { tenant_id: string }>(
  activeTenantIds: ReadonlySet<string>,
  jobs: T[],
): { runnable: T[]; skipped: T[] } {
  const runnable = jobs.filter((job) => activeTenantIds.has(job.tenant_id));
  return { runnable, skipped: jobs.filter((job) => !activeTenantIds.has(job.tenant_id)) };
}
