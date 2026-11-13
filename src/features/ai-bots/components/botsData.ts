/**
 * M9 — Catálogo de proveedores de IA y datos del bot de demostración.
 */

import type { AiBotProvider } from "@/shared/types/database";

export interface AiProviderSpec {
  provider: AiBotProvider;
  name: string;
  description: string;
  keyPlaceholder: string;
  keyPrefix: string;
}

export const AI_PROVIDER_SPECS: AiProviderSpec[] = [
  {
    provider: "integrated",
    name: "IA incluida",
    description: "Modelo propio gestionado por ADlive CRM: listo para usar sin configurar nada.",
    keyPlaceholder: "",
    keyPrefix: "",
  },
  {
    provider: "openai",
    name: "OpenAI (ChatGPT)",
    description: "Conecta tu propia API key de OpenAI para respuestas con GPT-4o.",
    keyPlaceholder: "sk-…",
    keyPrefix: "sk-",
  },
  {
    provider: "anthropic",
    name: "Anthropic (Claude)",
    description: "Usa Claude Sonnet u Opus con tu API key de Anthropic.",
    keyPlaceholder: "sk-ant-…",
    keyPrefix: "sk-ant-",
  },
  {
    provider: "grok",
    name: "xAI (Grok)",
    description: "Conecta Grok de xAI con tu API key de la consola de X.",
    keyPlaceholder: "xai-…",
    keyPrefix: "xai-",
  },
  {
    provider: "gemini",
    name: "Google (Gemini)",
    description: "Usa Gemini 2.0 con tu API key de Google AI Studio.",
    keyPlaceholder: "AIza…",
    keyPrefix: "AIza",
  },
];

export const PROVIDER_LABELS: Record<AiBotProvider, string> = {
  integrated: "IA incluida",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  grok: "xAI (Grok)",
  gemini: "Google (Gemini)",
};

/** Enmascara una API key mostrando solo su prefijo canónico: `sk-••••••••`. */
export function maskApiKey(raw: string, prefix: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  if (prefix && trimmed.startsWith(prefix)) return `${prefix}${"•".repeat(8)}`;
  return `${trimmed.slice(0, 3)}${"•".repeat(8)}`;
}

/** Bot de demostración precargado al pulsar `Bot de ejemplo: Placita Express`. */
export const DEMO_BOT_INPUT = {
  name: "Bot de ejemplo: Placita Express",
  product_line: "Portabilidad Prepago a Pospago",
  provider: "openai" as AiBotProvider,
  system_prompt:
    "Eres el asesor virtual de Placita Express, call center de ADLIVE SAS. Atiende leads de portabilidad Movistar: saluda, identifica el operador actual del cliente, presenta el plan de 50GB + llamadas ilimitadas a $23.000 con el primer mes gratis, supera objeciones de precio y agenda la llamada de cierre con un asesor humano. Responde siempre en español, con tono cercano y máximo 3 líneas por mensaje.",
};
