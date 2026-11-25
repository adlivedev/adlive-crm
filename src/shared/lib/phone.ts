/**
 * Validación y normalización estricta de teléfonos al estilo E.164.
 * Enfoque Colombia (+57): acepta móviles de 10 dígitos (3XX...) y fijos de
 * 7 dígitos con indicativo, además de formatos ya en E.164 (+573XXXXXXXX).
 *
 * Reglas:
 * - Se eliminan espacios, guiones, paréntesis y el prefijo internacional 00/011.
 * - "3001234567" / "57 300 123 4567" / "+57 300 123 4567" → "+573001234567".
 * - Se rechazan números cortos, servicios (03XX distintos de 3XX móvil),
 *   dígitos repetidos sospechosos y cualquier cosa que no sea dígitos tras limpiar.
 */

const CO_MOBILE_PREFIXES = new Set([
  "300", "301", "302", "303", "304", "305", "306", "307", "308", "309",
  "310", "311", "312", "313", "314", "315", "316", "317", "318", "319",
  "320", "321", "322", "323", "324", "325", "350", "351",
]);

export type PhoneValidation =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

function digitsOnly(raw: string): string {
  return raw.replace(/[\s\-().]/g, "").replace(/^(00|011)/, "");
}

/**
 * Normaliza un teléfono a E.164 de Colombia. Devuelve { ok: false, reason }
 * cuando el número no es válido — nunca lanza excepción.
 */
export function normalizeCoPhone(raw: string | null | undefined): PhoneValidation {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, reason: "El teléfono es obligatorio." };

  let digits = digitsOnly(input);
  if (input.startsWith("+")) digits = digits.replace(/^\+/, "");

  if (!/^\d+$/.test(digits)) return { ok: false, reason: "El teléfono solo puede contener dígitos." };

  // Quitar prefijo de país 57 si viene completo.
  if (digits.startsWith("57") && digits.length === 12) digits = digits.slice(2);

  if (digits.length === 10 && CO_MOBILE_PREFIXES.has(digits.slice(0, 3))) {
    return { ok: true, e164: `+57${digits}` };
  }

  if (digits.length === 7) {
    // Fijo nacional sin indicativo: no es enviable por WhatsApp, se rechaza.
    return { ok: false, reason: "Falta el indicativo de ciudad para el número fijo." };
  }

  if (digits.length === 8 && digits.startsWith("60")) {
    const local = digits.slice(2);
    if (local.length === 6) return { ok: false, reason: "Falta el indicativo de ciudad para el número fijo." };
  }

  return {
    ok: false,
    reason: "Número no válido para Colombia: usa 10 dígitos móviles (3XX...).",
  };
}

/** Alias tolerante: devuelve el E.164 o null. */
export function toE164(raw: string | null | undefined): string | null {
  const result = normalizeCoPhone(raw);
  return result.ok ? result.e164 : null;
}

/** Misma normalización pero exige éxito (para rutas server con zod refinements). */
export function requireE164(raw: string): string {
  const result = normalizeCoPhone(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.e164;
}
