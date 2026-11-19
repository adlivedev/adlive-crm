import "server-only";

import { z } from "zod";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { sendMetaText } from "@/shared/lib/metaWhatsAppClient";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { AiBotProvider } from "@/shared/types/database";

type SupportedProvider = Exclude<AiBotProvider, "integrated">;
interface ChatTurn { role: "user" | "assistant"; content: string }

const providerSchema = z.enum(["openai", "anthropic", "grok", "gemini"]);
const responseText = z.string().trim().min(1).max(4000);

async function providerFetch(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`El proveedor de IA respondió con estado ${response.status}.`);
  return response.json() as Promise<unknown>;
}

async function generateWithOpenAiCompatible(
  provider: "openai" | "grok",
  apiKey: string,
  systemPrompt: string,
  history: ChatTurn[],
): Promise<string> {
  const isOpenAi = provider === "openai";
  const model = (isOpenAi ? process.env.OPENAI_MODEL : process.env.XAI_MODEL)?.trim()
    || (isOpenAi ? "gpt-4o-mini" : "grok-3-mini");
  const json = await providerFetch(isOpenAi ? "https://api.openai.com/v1/chat/completions" : "https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, ...history], max_tokens: 500, temperature: 0.3 }),
  });
  const parsed = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).parse(json);
  return responseText.parse(parsed.choices[0]!.message.content).slice(0, 1500);
}

async function generateWithAnthropic(apiKey: string, systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const json = await providerFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5",
      max_tokens: 500,
      temperature: 0.3,
      system: systemPrompt,
      messages: history,
    }),
  });
  const parsed = z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) }).parse(json);
  return responseText.parse(parsed.content.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n")).slice(0, 1500);
}

async function generateWithGemini(apiKey: string, systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const json = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: history.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
    }),
  });
  const parsed = z.object({ candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1) }).parse(json);
  return responseText.parse(parsed.candidates[0]!.content.parts.map((part) => part.text ?? "").join("\n")).slice(0, 1500);
}

async function generateBotText(provider: SupportedProvider, tenantId: string, systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const vaultProvider = `ai_${provider}`;
  const { data, error } = await createAdminClient().from("tenant_integrations_vault")
    .select("encrypted_credentials").eq("tenant_id", tenantId).eq("provider", vaultProvider).eq("is_connected", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("El proveedor del bot no tiene una API key configurada.");
  const apiKey = decryptVaultCredentials(data.encrypted_credentials, tenantId, vaultProvider).api_key?.trim();
  if (!apiKey) throw new Error("La API key del proveedor está vacía.");
  if (provider === "anthropic") return generateWithAnthropic(apiKey, systemPrompt, history);
  if (provider === "gemini") return generateWithGemini(apiKey, systemPrompt, history);
  return generateWithOpenAiCompatible(provider, apiKey, systemPrompt, history);
}

/** Procesa un inbound ya persistido. La columna in_reply_to_message_id evita respuestas duplicadas. */
export async function processAiBotReply(waMessageId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: inbound, error: inboundError } = await admin.from("messages")
    .select("id,tenant_id,conversation_id").eq("wa_message_id", waMessageId).eq("direction", "inbound").maybeSingle();
  if (inboundError) throw inboundError;
  if (!inbound) return;

  const { data: conversation, error: conversationError } = await admin.from("conversations")
    .select("id,tenant_id,contact_id,handler_mode").eq("id", inbound.conversation_id).eq("tenant_id", inbound.tenant_id).single();
  if (conversationError) throw conversationError;
  if (conversation.handler_mode !== "bot") return;

  const [{ data: contact, error: contactError }, { data: bot, error: botError }] = await Promise.all([
    admin.from("contacts").select("id,phone_e164,opt_out_marketing").eq("id", conversation.contact_id).single(),
    admin.from("ai_bots").select("provider,system_prompt").eq("tenant_id", inbound.tenant_id).eq("is_active", true).order("created_at").limit(1).maybeSingle(),
  ]);
  if (contactError) throw contactError;
  if (botError) throw botError;
  if (!contact || contact.opt_out_marketing || !bot) return;
  const parsedProvider = providerSchema.safeParse(bot.provider);
  if (!parsedProvider.success) return;

  const { data: historyRows, error: historyError } = await admin.from("messages")
    .select("direction,body,msg_type").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(12);
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
    const answer = await generateBotText(parsedProvider.data, inbound.tenant_id, bot.system_prompt, history);
    await admin.from("messages").update({ body: answer }).eq("id", pending.id);
    const waMessageIdSent = await sendMetaText(inbound.tenant_id, contact.phone_e164, answer);
    await admin.from("messages").update({ wa_message_id: waMessageIdSent, status: "sent", error_reason: null }).eq("id", pending.id);
    const now = new Date().toISOString();
    await admin.from("conversations").update({
      last_message_at: now,
      last_message_preview: answer.slice(0, 120),
      last_message_media_type: "text",
      needs_reply: false,
      unread_count: 0,
    }).eq("id", conversation.id);
  } catch (error) {
    await admin.from("messages").update({
      status: "failed",
      error_reason: error instanceof Error ? error.message.slice(0, 500) : "No se pudo generar la respuesta del bot.",
    }).eq("id", pending.id);
    throw error;
  }
}
