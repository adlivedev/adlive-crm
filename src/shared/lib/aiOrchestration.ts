/** Lógica pura del orquestador multi-bot (Fase 2): determinista, sin BD ni red,
 *  para poder probarla en tests. Garantiza que NUNCA respondan dos bots al mismo
 *  mensaje: en el primer mensaje responde el bot de mayor prioridad (menor
 *  número); en los siguientes, si coinciden palabras clave o la intención con el
 *  bot de precios o FAQ, delega a ese único bot. */

export interface BotOrchestrationCandidate {
  id: string;
  priority: number;
  bot_role: string;
  trigger_keywords: string[] | null;
}

export const ROLE_INTENT_PATTERNS: Record<string, RegExp> = {
  pricing: /precio|precios|plan|planes|costo|coste|tarifa|tarifas|cu[aá]nto|cuesta|valor|valores|oferta|descuento|promo/i,
  faq: /horario|horarios|soporte|ayuda|c[oó]mo|d[oó]nde|garant[ií]a|garantizan|funciona|cobertura|requisito|documento/i,
};

/** Selecciona el ÚNICO bot que debe responder (ver documentación del módulo). */
export function selectBotForMessage<T extends BotOrchestrationCandidate>(
  bots: T[],
  messageText: string,
  isFirstMessage: boolean,
): T | null {
  const sorted = [...bots].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  if (sorted.length === 0) return null;
  if (isFirstMessage) return sorted[0]!;
  const text = messageText.toLowerCase();
  const byKeywords = sorted.find((bot) => (bot.trigger_keywords ?? []).some((keyword) => keyword.trim() && text.includes(keyword.trim().toLowerCase())));
  if (byKeywords) return byKeywords;
  for (const [role, pattern] of Object.entries(ROLE_INTENT_PATTERNS)) {
    if (pattern.test(messageText)) {
      const match = sorted.find((bot) => bot.bot_role === role);
      if (match) return match;
    }
  }
  return sorted[0]!;
}
