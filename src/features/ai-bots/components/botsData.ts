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
    name: "IA de plataforma",
    description: "Disponible únicamente cuando el operador configura un modelo central para este despliegue.",
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
  integrated: "IA de plataforma",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  grok: "xAI (Grok)",
  gemini: "Google (Gemini)",
};

/** Modelos seleccionables por proveedor (Fase 2). Espejo client-safe de PROVIDER_MODELS del servicio. */
export const PROVIDER_MODELS: Record<Exclude<AiBotProvider, "integrated">, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-flash-latest"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku", "claude-3-5-sonnet"],
  grok: ["grok-2", "grok-3-mini"],
};

/** Roles del orquestador multi-bot (Fase 2). */
export const BOT_ROLE_OPTIONS: Array<{ id: "greeter" | "pricing" | "faq" | "custom"; label: string; hint: string }> = [
  { id: "greeter", label: "Saludo y guía", hint: "Atiende el primer mensaje y orienta al cliente." },
  { id: "pricing", label: "Precios y planes", hint: "Responde precios, planes, costos y promociones." },
  { id: "faq", label: "Preguntas frecuentes", hint: "Resuelve dudas de soporte, horarios y trámites." },
  { id: "custom", label: "Personalizado", hint: "Sin rol fijo: responde según sus palabras clave o su prioridad." },
];

export interface BotObjectivePreset {
  id: string;
  label: string;
  prompt: string;
}

/** Presets de objetivo para el formulario guiado: se compilan en el system_prompt. */
export const BOT_OBJECTIVE_PRESETS: BotObjectivePreset[] = [
  {
    id: "calificar_portabilidad",
    label: "Calificar leads de portabilidad/planes",
    prompt:
      "Tu objetivo principal es calificar a cada cliente interesado en portar su línea o cambiar de plan. " +
      "Haz preguntas clave para entender su necesidad: qué plan usa hoy, cuánto paga, cuántas líneas necesita y qué uso le da. " +
      "Con esa información, prioriza los leads más calientes y deja el resumen listo para el asesor comercial.",
  },
  {
    id: "precios_beneficios",
    label: "Dar precios y beneficios",
    prompt:
      "Tu objetivo principal es responder con claridad y rapidez las preguntas sobre precios, planes y beneficios de los servicios. " +
      "Usa únicamente la información del negocio que aparece más abajo y sé preciso con cifras y condiciones.",
  },
  {
    id: "soporte_faq",
    label: "Soporte y preguntas frecuentes",
    prompt:
      "Tu objetivo principal es resolver dudas frecuentes de los clientes: cobertura, facturación, cambios de plan, trámites y horarios de atención. " +
      "Responde con paciencia y pasos concretos; si no conoces la respuesta, sé honesto y pasa la conversación a un asesor humano.",
  },
  {
    id: "personalizado",
    label: "Personalizado",
    prompt: "",
  },
];

export interface BotToneOption {
  id: string;
  label: string;
  prompt: string;
}

/** Opciones de tono para el formulario guiado. */
export const BOT_TONE_OPTIONS: BotToneOption[] = [
  {
    id: "cercano",
    label: "Cercano y comercial",
    prompt:
      "Tono cercano y comercial: saluda por el nombre del cliente cuando lo sepas, usa un lenguaje cálido y sencillo, " +
      "y no pierdas una oportunidad de sugerir el siguiente paso de compra sin ser insistente.",
  },
  {
    id: "formal",
    label: "Formal",
    prompt:
      "Tono formal y profesional: usa un lenguaje respetuoso y bien redactado, sin abreviaturas ni emojis, " +
      "como corresponde a una empresa de servicios seria.",
  },
  {
    id: "directo",
    label: "Directo",
    prompt:
      "Tono directo: responde de forma breve y concreta, sin rodeos; una pregunta, una respuesta clara.",
  },
];

export interface CompileBotPromptInput {
  objectivePresetId: string;
  customObjective: string;
  knowledge: string;
  handoffRule: string;
  toneId: string;
}

/**
 * Compila el formulario guiado (objetivo + conocimiento + handoff + tono) en un
 * system_prompt limpio en español, sin tocar la columna existente de la base de datos.
 */
export function compileBotPrompt(input: CompileBotPromptInput): string {
  const preset = BOT_OBJECTIVE_PRESETS.find((p) => p.id === input.objectivePresetId);
  const objective = input.objectivePresetId === "personalizado"
    ? input.customObjective.trim()
    : (preset?.prompt ?? "").trim();
  const tone = BOT_TONE_OPTIONS.find((t) => t.id === input.toneId)?.prompt ?? BOT_TONE_OPTIONS[0]!.prompt;
  const knowledge = input.knowledge.trim();
  const handoff = input.handoffRule.trim();

  const sections: string[] = [
    "Eres el asistente virtual de este negocio y respondes dentro de WhatsApp.",
    objective ? `OBJETIVO DEL BOT\n${objective}` : "",
    knowledge
      ? `INFORMACIÓN DEL NEGOCIO (usa solo estos datos; si algo no está aquí, dilo con honestidad y no inventes precios)\n${knowledge}`
      : "Si te preguntan algo que no conoces, dilo con honestidad y no inventes precios ni condiciones.",
    handoff
      ? `REGLA DE TRASPASO A ASESOR HUMANO\n${handoff} Cuando se cumpla la regla, indica al cliente que un asesor humano continuará la conversación y no sigas respondiendo como bot.`
      : "Si el cliente pide hablar con una persona o plantea algo que no puedes resolver, indica que un asesor humano continuará la conversación.",
    `TONO DE RESPUESTA\n${tone}`,
  ].filter(Boolean);

  return sections.join("\n\n");
}

/** Enmascara una API key mostrando solo su prefijo canónico: `sk-••••••••`. */
export function maskApiKey(raw: string, prefix: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  if (prefix && trimmed.startsWith(prefix)) return `${prefix}${"•".repeat(8)}`;
  return `${trimmed.slice(0, 3)}${"•".repeat(8)}`;
}
