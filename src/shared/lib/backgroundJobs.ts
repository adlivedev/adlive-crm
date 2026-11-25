/** Política de reintentos de la cola background_jobs (Fase 2): backoff lineal
 *  en minutos, con tope. Lógica pura para poder probarla en tests. */

/** Minutos de espera antes del siguiente intento (1º fallo → 1 min, 2º → 2… tope 5). */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(Math.max(attempts, 1), 5);
}

/** Timestamp ISO del próximo intento. */
export function nextRetryRunAfter(attempts: number, from: Date = new Date()): string {
  return new Date(from.getTime() + retryDelayMinutes(attempts) * 60_000).toISOString();
}
