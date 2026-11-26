import "server-only";

import { z } from "zod";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { sendMetaText } from "@/shared/lib/metaWhatsAppClient";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { selectBotForMessage } from "@/shared/lib/aiOrchestration";
import type { AiBotProvider } from "@/shared/types/database";

type SupportedProvider = Exclude<AiBotProvider, "integrated">;
interface ChatTurn { role: "user" | "assistant"; content: string }
interface TokenUsage { promptTokens: number; completionTokens: number; totalTokens: number }

const providerSchema = z.enum(["openai", "anthropic", "grok", "gemini"]);
const responseText = z.string().trim().min(1).max(4000);

/** Modelos seleccionables por proveedor (Fase 2). */
export const PROVIDER_MODELS: Record<SupportedProvider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-flash-latest"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku", "claude-3-5-sonnet"],
  grok: ["grok-2", "grok-3-mini"],
};

/** Precios aproximados USD por 1M de tokens (entrada/salida) para costo estimado. */
const MODEL_PRICING_USD_PER_M: Record<string, [number, number]> = {
  "gemini-2.5-flash": [0.3, 2.5], "gemini-2.5-pro": [1.25, 10], "gemini-2.0-flash": [0.1, 0.4],
  "gemini-flash-latest": [0.3, 2.5], "gemini-flash-lite-latest": [0.1, 0.4],
  "gpt-4o-mini": [0.15, 0.6], "gpt-4o": [2.5, 10],
  "claude-3-5-haiku": [0.8, 4], "claude-3-5-sonnet": [3, 15], "claude-haiku-4-5": [1, 5],
  "grok-2": [2, 10], "grok-3-mini": [0.3, 0.5],
};

/** Formato esperado de API key por proveedor (para diagnósticos de «Probar conexión»). */
export const PROVIDER_KEY_FORMAT: Record<SupportedProvider, { prefix: string; where: string }> = {
  gemini: { prefix: "AIza", where: "Google AI Studio (aistudio.google.com → «Get API Key»). Las claves empiezan por AIza…; si la tuya empieza por AQ.A… es un token de aplicación, no una API key." },
  openai: { prefix: "sk-", where: "platform.openai.com → API Keys." },
  anthropic: { prefix: "sk-ant-", where: "console.anthropic.com → API Keys." },
  grok: { prefix: "xai-", where: "console.x.ai → API Keys." },
};

export class ProviderHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`El proveedor de IA respondió con estado ${status}.`);
    this.name = "ProviderHttpError";
    this.status = status;
  }
}

async function providerFetch(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new ProviderHttpError(response.status);
  return response.json() as Promise<unknown>;
}

function estimateCostUsd(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING_USD_PER_M[model];
  if (!pricing) return 0;
  return Number(((usage.promptTokens * pricing[0] + usage.completionTokens * pricing[1]) / 1_000_000).toFixed(6));
}

async function generateWithModel(
  provider: SupportedProvider,
  model: string,
  apiKey: string,
  systemPrompt: string,
  history: ChatTurn[],
): Promise<{ text: string; usage: TokenUsage }> {
  if (provider === "gemini") {
    const json = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: history.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
      }),
    });
    const parsed = z.object({
      candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1),
      usageMetadata: z.object({ promptTokenCount: z.number().optional(), candidatesTokenCount: z.number().optional(), totalTokenCount: z.number().optional() }).optional(),
    }).parse(json);
    const text = responseText.parse(parsed.candidates[0]!.content.parts.map((part) => part.text ?? "").join("\n")).slice(0, 1500);
    const meta = parsed.usageMetadata;
    const promptTokens = meta?.promptTokenCount ?? 0;
    const completionTokens = meta?.candidatesTokenCount ?? 0;
    return { text, usage: { promptTokens, completionTokens, totalTokens: meta?.totalTokenCount ?? promptTokens + completionTokens } };
  }
  if (provider === "anthropic") {
    const json = await providerFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 500, temperature: 0.3, system: systemPrompt, messages: history }),
    });
    const parsed = z.object({
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
      usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
    }).parse(json);
    const text = responseText.parse(parsed.content.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n")).slice(0, 1500);
    const promptTokens = parsed.usage?.input_tokens ?? 0;
    const completionTokens = parsed.usage?.output_tokens ?? 0;
    return { text, usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } };
  }
  const isOpenAi = provider === "openai";
  const json = await providerFetch(isOpenAi ? "https://api.openai.com/v1/chat/completions" : "https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, ...history], max_tokens: 500, temperature: 0.3 }),
  });
  const parsed = z.object({
    choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
    usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional(), total_tokens: z.number().optional() }).optional(),
  }).parse(json);
  const promptTokens = parsed.usage?.prompt_tokens ?? 0;
  const completionTokens = parsed.usage?.completion_tokens ?? 0;
  return {
    text: responseText.parse(parsed.choices[0]!.message.content).slice(0, 1500),
    usage: { promptTokens, completionTokens, totalTokens: parsed.usage?.total_tokens ?? promptTokens + completionTokens },
  };
}

/** Modelos en orden de preferencia cuando el bot no define uno propio. Algunas API
 * keys restringidas no tienen acceso a gemini-2.5-flash (404) y se salta al alias
 * gemini-flash-latest; un 503 (saturación) se reintenta una vez antes de saltar. */
const GEMINI_DEFAULT_CHAIN = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];
const DEFAULT_CHAIN: Record<SupportedProvider, string[]> = {
  gemini: GEMINI_DEFAULT_CHAIN, openai: ["gpt-4o-mini"], anthropic: ["claude-haiku-4-5"], grok: ["grok-3-mini"],
};

interface GenerateOptions { botId?: string | null; model?: string | null; fallbackModels?: string[] | null }

/** Invoca al proveedor con el modelo principal y, ante saturación/cuota (429, 503,
 * 404 o timeout de 12 s), cambia automáticamente al siguiente modelo de respaldo.
 * Registra cada invocación en ai_usage_logs y devuelve el texto de respuesta. */
export async function generateBotText(
  provider: SupportedProvider,
  tenantId: string,
  systemPrompt: string,
  history: ChatTurn[],
  options: GenerateOptions = {},
): Promise<string> {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const vaultProvider = `ai_${provider}`;
  const { data, error } = await admin.from("tenant_integrations_vault")
    .select("encrypted_credentials").eq("tenant_id", tenantId).eq("provider", vaultProvider).eq("is_connected", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("El proveedor del bot no tiene una API key configurada.");
  const apiKey = decryptVaultCredentials(data.encrypted_credentials, tenantId, vaultProvider).api_key?.trim();
  if (!apiKey) throw new Error("La API key del proveedor está vacía.");

  const configured = (options.model ? [options.model, ...(options.fallbackModels ?? [])] : []).filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
  const chain = configured.length > 0 ? configured : DEFAULT_CHAIN[provider];
  let lastError: unknown = null;
  let usedModel = chain[0] ?? "unknown";

  for (const model of chain) {
    usedModel = model;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { text, usage } = await generateWithModel(provider, model, apiKey, systemPrompt, history);
        const latencyMs = Date.now() - startedAt;
        await admin.from("ai_usage_logs").insert({
          tenant_id: tenantId, bot_id: options.botId ?? null, provider, model_name: model,
          prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, total_tokens: usage.totalTokens,
          estimated_cost_usd: estimateCostUsd(model, usage), status: "success", latency_ms: latencyMs, error_code: null,
        }).then(({ error: logError }) => { if (logError) console.error("[ai_usage_logs]", logError.message); });
        return text;
      } catch (error) {
        lastError = error;
        if (!(error instanceof ProviderHttpError)) {
          if (error instanceof Error && error.name === "TimeoutError") {
            // timeout de 12 s: continuar con el modelo de respaldo
            break;
          }
          throw error;
        }
        if (error.status === 404 || error.status === 429) break; // sin acceso o cuota: siguiente modelo
        if (error.status === 503) {
          if (attempt === 0) { await new Promise((resolve) => setTimeout(resolve, 2500)); continue; }
          break;
        }
        throw error;
      }
    }
  }
  const latencyMs = Date.now() - startedAt;
  const errorCode = lastError instanceof ProviderHttpError ? `http_${lastError.status}` : lastError instanceof Error ? lastError.name : "unknown";
  console.error("[ai-bots] Fallo de generación", JSON.stringify({ tenantId, botId: options.botId ?? null, provider, model: usedModel, errorCode }));
  await admin.from("ai_usage_logs").insert({
    tenant_id: tenantId, bot_id: options.botId ?? null, provider, model_name: usedModel,
    prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0,
    status: "error", latency_ms: latencyMs, error_code: errorCode,
  }).then(({ error: logError }) => { if (logError) console.error("[ai_usage_logs]", logError.message); });
  throw lastError ?? new Error("Ningún modelo del proveedor estuvo disponible.");
}

/**
 * Sprint 2 — Genera UNA respuesta de prueba para el panel «Probar Bot en Vivo».
 * Reutiliza la llave cifrada del vault y el proveedor real del bot, sin tocar
 * WhatsApp ni crear mensajes o contactos.
 */
export async function generateBotAnswerForTest(
  provider: SupportedProvider,
  tenantId: string,
  systemPrompt: string,
  testMessage: string,
  options: GenerateOptions = {},
): Promise<string> {
  return generateBotText(provider, tenantId, systemPrompt, [{ role: "user", content: testMessage.slice(0, 2000) }], options);
}

export interface ProviderTestResult {
  ok: boolean;
  status: "connected" | "no_key" | "format_warning" | "http_error";
  message: string;
  model?: string;
  latencyMs?: number;
  httpStatus?: number;
}

/** Fase 2 — Prueba real de conexión por proveedor con la API key cifrada del vault. */
export async function testProviderConnection(provider: SupportedProvider, tenantId: string): Promise<ProviderTestResult> {
  const admin = createAdminClient();
  const vaultProvider = `ai_${provider}`;
  const { data, error } = await admin.from("tenant_integrations_vault")
    .select("encrypted_credentials").eq("tenant_id", tenantId).eq("provider", vaultProvider).eq("is_connected", true).maybeSingle();
  if (error) throw error;
  if (!data) {
    return { ok: false, status: "no_key", message: `${vaultProvider} no tiene una API key guardada en este workspace. Configúrala primero.` };
  }
  const apiKey = decryptVaultCredentials(data.encrypted_credentials, tenantId, vaultProvider).api_key?.trim();
  if (!apiKey) return { ok: false, status: "no_key", message: "La API key guardada está vacía. Vuelve a configurarla." };

  const format = PROVIDER_KEY_FORMAT[provider];
  const formatWarning = apiKey.startsWith(format.prefix) ? null
    : `Aviso de formato: las claves de ${provider} suelen empezar por «${format.prefix}». La tuya empieza por «${apiKey.slice(0, 4)}…». ${format.where}`;

  const chain = DEFAULT_CHAIN[provider];
  const startedAt = Date.now();
  /* QA-NEW-007: igual que generateBotText — si el primer modelo de la cadena
     no está habilitado para esta key (404) o está saturado (429/503/timeout),
     se recorre el resto de DEFAULT_CHAIN[provider] antes de declarar fallo. */
  let lastError: unknown = null;
  let lastModel = chain[0] ?? "unknown";
  let fatalError = false;
  for (const candidate of chain) {
    lastModel = candidate;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await generateWithModel(provider, candidate, apiKey, "Responde únicamente: OK", [{ role: "user", content: "Di OK" }]);
        const latencyMs = Date.now() - startedAt;
        const fallbackNote = candidate !== chain[0] ? ` (recuperado vía respaldo: el modelo ${chain[0]} no respondió)` : "";
        return {
          ok: true, status: formatWarning ? "format_warning" : "connected", model: candidate, latencyMs,
          message: formatWarning ? `Conexión exitosa con ${candidate} en ${latencyMs} ms.${fallbackNote} ${formatWarning}` : `Conexión exitosa con ${candidate} en ${latencyMs} ms.${fallbackNote} El proveedor respondió correctamente.`,
        };
      } catch (caught) {
        lastError = caught;
        if (!(caught instanceof ProviderHttpError)) {
          if (caught instanceof Error && caught.name === "TimeoutError") break; // timeout: siguiente modelo
          const latencyMs = Date.now() - startedAt;
          return { ok: false, status: "http_error", model: candidate, latencyMs, message: formatWarning ? `No se pudo conectar con el proveedor. ${formatWarning}` : "No se pudo conectar con el proveedor. Revisa tu conexión y la clave." };
        }
        if (caught.status === 404 || caught.status === 429) break; // sin acceso o cuota: siguiente modelo
        if (caught.status === 503) {
          if (attempt === 0) { await new Promise((resolve) => setTimeout(resolve, 2500)); continue; }
          break;
        }
        /* 400/401/403 u otro error: la clave o el modelo es rechazado de
           plano, no tiene sentido probar más modelos de la cadena. */
        fatalError = true;
        break;
      }
    }
    if (fatalError) break;
  }
  const latencyMs = Date.now() - startedAt;
  const httpStatus = lastError instanceof ProviderHttpError ? lastError.status : undefined;
  console.error("[ai-bots/providers/test]", JSON.stringify({ tenantId, provider, model: lastModel, httpStatus: httpStatus ?? null, error: lastError instanceof Error ? lastError.message : String(lastError) }));
  const diagnostics = httpStatus === 400 || httpStatus === 401 || httpStatus === 403
    ? `El proveedor rechazó la clave (HTTP ${httpStatus}). Verifica que la API key sea válida y esté activa. ${format.where}`
    : httpStatus === 404 ? `Ningún modelo de la cadena (${chain.join(", ")}) está disponible para esta clave (HTTP 404). Prueba otro modelo en el selector del bot.`
      : httpStatus === 429 ? `Cuota agotada o límite de peticiones (HTTP 429). Espera unos minutos o revisa el plan.`
        : httpStatus === 503 ? `El proveedor está saturado (HTTP 503). Intenta de nuevo en unos segundos.`
          : `No se pudo conectar con el proveedor${httpStatus ? ` (HTTP ${httpStatus})` : ""}. Revisa tu conexión y la clave.`;
  return { ok: false, status: "http_error", model: lastModel, latencyMs, httpStatus, message: formatWarning ? `${diagnostics} ${formatWarning}` : diagnostics };
}

/** El orquestador vive en @/shared/lib/aiOrchestration (lógica pura, testeable);
 *  aquí se re-exporta para compatibilidad de importaciones del servicio. */

/** Procesa un inbound ya persistido. La columna in_reply_to_message_id evita respuestas duplicadas. */
export async function processAiBotReply(waMessageId: string, expectedTenantId?: string): Promise<void> {
  const admin = createAdminClient();
  let inboundQuery = admin.from("messages")
    .select("id,tenant_id,conversation_id,body,created_at").eq("wa_message_id", waMessageId).eq("direction", "inbound");
  if (expectedTenantId) inboundQuery = inboundQuery.eq("tenant_id", expectedTenantId);
  const { data: inbound, error: inboundError } = await inboundQuery.maybeSingle();
  if (inboundError) throw inboundError;
  if (!inbound) return;

  const { data: conversation, error: conversationError } = await admin.from("conversations")
    .select("id,tenant_id,contact_id,handler_mode").eq("id", inbound.conversation_id).eq("tenant_id", inbound.tenant_id).single();
  if (conversationError) throw conversationError;
  if (conversation.handler_mode !== "bot") return;

  const [{ data: contact, error: contactError }, { data: bots, error: botsError }, { count: priorInboundCount, error: countError }, { data: tenantPrefs }] = await Promise.all([
    admin.from("contacts").select("id,phone_e164,opt_out_marketing").eq("id", conversation.contact_id).eq("tenant_id", inbound.tenant_id).single(),
    admin.from("ai_bots").select("id,provider,system_prompt,model_name,fallback_models,priority,bot_role,trigger_keywords")
      .eq("tenant_id", inbound.tenant_id).eq("is_active", true),
    admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id).eq("tenant_id", inbound.tenant_id).eq("direction", "inbound").lt("created_at", inbound.created_at),
    admin.from("tenants").select("default_bot_id").eq("id", inbound.tenant_id).maybeSingle(),
  ]);
  if (contactError) throw contactError;
  if (botsError) throw botsError;
  if (countError) throw countError;
  const eligibleBots = (bots ?? []).filter((bot) => providerSchema.safeParse(bot.provider).success);
  if (!contact || eligibleBots.length === 0) return;

  // Orquestador determinista: un solo bot responde, con trazabilidad estructurada.
  const isFirstMessage = (priorInboundCount ?? 0) === 0;
  const preferred = isFirstMessage && tenantPrefs?.default_bot_id
    ? eligibleBots.find((bot) => bot.id === tenantPrefs.default_bot_id) ?? null
    : null;
  const chosen = preferred ?? selectBotForMessage(eligibleBots, inbound.body ?? "", isFirstMessage);
  if (!chosen) return;
  console.log("[ai-bots/orchestrator]", JSON.stringify({ tenantId: inbound.tenant_id, conversationId: conversation.id, chosenBotId: chosen.id, isFirstMessage }));

  const { data: historyRows, error: historyError } = await admin.from("messages")
    .select("direction,body,msg_type").eq("conversation_id", conversation.id).eq("tenant_id", inbound.tenant_id)
    .order("created_at", { ascending: false }).limit(12);
  if (historyError) throw historyError;
  const history: ChatTurn[] = (historyRows ?? []).reverse().flatMap((message) => message.body && ["text", "system"].includes(message.msg_type)
    ? [{ role: message.direction === "inbound" ? "user" : "assistant", content: message.body.slice(0, 4000) }]
    : []);

  const { data: pending, error: pendingError } = await admin.from("messages").insert({
    tenant_id: inbound.tenant_id,
    conversation_id: conversation.id,
    in_reply_to_message_id: inbound.id,
    direction: "outbound",
    msg_type: "text",
    body: null,
    status: "queued",
  }).select("id").maybeSingle();
  if (pendingError) {
    if (pendingError.code === "23505") return;
    throw pendingError;
  }
  if (!pending) return;

  try {
    const answer = await generateBotText(parsedProviderOrThrow(chosen.provider), inbound.tenant_id, chosen.system_prompt, history, {
      botId: chosen.id, model: chosen.model_name, fallbackModels: chosen.fallback_models,
    });
    await admin.from("messages").update({ body: answer }).eq("id", pending.id).eq("tenant_id", inbound.tenant_id);
    const waMessageIdSent = await sendMetaText(inbound.tenant_id, contact.phone_e164, answer);
    await admin.from("messages").update({ wa_message_id: waMessageIdSent, status: "sent", error_reason: null }).eq("id", pending.id).eq("tenant_id", inbound.tenant_id);
    const now = new Date().toISOString();
    await admin.from("conversations").update({
      last_message_at: now,
      last_message_preview: answer.slice(0, 120),
      last_message_media_type: "text",
      needs_reply: false,
      unread_count: 0,
    }).eq("id", conversation.id).eq("tenant_id", inbound.tenant_id);
  } catch (error) {
    await admin.from("messages").update({
      status: "failed",
      error_reason: error instanceof Error ? error.message.slice(0, 500) : "No se pudo generar la respuesta del bot.",
    }).eq("id", pending.id).eq("tenant_id", inbound.tenant_id);
    throw error;
  }
}

function parsedProviderOrThrow(provider: string): SupportedProvider {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) throw new Error(`Proveedor de IA no soportado: ${provider}`);
  return parsed.data;
}
