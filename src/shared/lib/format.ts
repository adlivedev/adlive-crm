/**
 * Utilidades de formato compartidas (nativas, sin dependencias — Skill 4).
 */

const COP_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("es-CO");

/** $ 38.000 (pesos colombianos, sin decimales). */
export function formatCOP(value: number): string {
  return COP_FORMATTER.format(value).replace(/\s/g, " ");
}

/** 24.077 (separador de miles es-CO). */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

/** 06 nov 2026 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** 14:17 */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** hace 56 min · hace 2 h · hace 3 d */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  return formatDate(iso);
}

/** Iniciales para avatares: "Liz Estefany Buitrago" → "LB". */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** Etiqueta legible de rol: dueño / admin / agente. */
export function roleLabel(role: "owner" | "admin" | "agent"): string {
  switch (role) {
    case "owner":
      return "dueño";
    case "admin":
      return "admin";
    case "agent":
      return "agente";
  }
}

/** Claves YYYY-MM de los últimos N meses (orden cronológico). */
export function lastMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Nombre corto del mes en español: 2026-10 → "Oct". */
export function monthShortLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const label = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
