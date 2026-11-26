/**
 * QA-NEW-010 — Rutas públicas que no requieren sesión: landings (/l/),
 * formularios embebidos (/embed/), login y recuperación de contraseña.
 * En ellas el CRM no debe disparar getUser() ni consultas autenticadas
 * (evita ruido 401/403 en Network y en los logs de Postgres).
 */

const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/register",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
]);

const PUBLIC_PREFIXES = ["/embed/", "/l/"];

export function isPublicRoutePath(pathname: string): boolean {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
