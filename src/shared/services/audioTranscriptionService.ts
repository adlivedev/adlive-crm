import "server-only";

import { z } from "zod";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { downloadMetaMedia } from "@/shared/lib/metaWhatsAppClient";
import { createAdminClient } from "@/shared/lib/supabase/admin";

const transcriptionSchema = z.object({
  transcript: z.string(),
  summary: z.string(),
  flagged: z.boolean().default(false),
});

/**
 * Transcribe y resume un audio de WhatsApp usando la API key de Gemini del
 * vault del tenant (mismo cifrado que los bots IA). Devuelve también un
 * indicador neutral si detecta lenguaje ofensivo, para que el agente pueda
 * leer en lugar de escuchar.
 */
export async function transcribeAudioMessage(tenantId: string, messageId: string): Promise<{ transcript: string; summary: string; flagged: boolean }> {
  const admin = createAdminClient();

  /* 1) Llave Gemini del vault. */
  const vaultProvider = "ai_gemini";
  const { data: vault, error: vaultError } = await admin.from("tenant_integrations_vault")
    .select("encrypted_credentials").eq("tenant_id", tenantId).eq("provider", vaultProvider).eq("is_connected", true).maybeSingle();
  if (vaultError) throw vaultError;
  if (!vault) throw new Error("No hay una API key de Google Gemini configurada en este workspace.");
  const apiKey = decryptVaultCredentials(vault.encrypted_credentials, tenantId, vaultProvider).api_key?.trim();
  if (!apiKey) throw new Error("La API key de Gemini está vacía.");

  /* 2) Audio: URL directa (Storage) o descarga bajo demanda desde Meta. */
  const { data: message, error: messageError } = await admin.from("messages")
    .select("media_url,media_id,media_mime_type").eq("id", messageId).eq("tenant_id", tenantId).single();
  if (messageError || !message) throw new Error("Mensaje de audio no encontrado.");
  let bytes: ArrayBuffer;
  const mimeType = message.media_mime_type ?? "audio/ogg";
  if (message.media_url) {
    const response = await fetch(message.media_url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("No se pudo descargar el audio.");
    bytes = await response.arrayBuffer();
  } else if (message.media_id) {
    const upstream = await downloadMetaMedia(tenantId, message.media_id);
    if (!upstream.ok || !upstream.body) throw new Error("Meta no pudo entregar el audio.");
    bytes = await upstream.arrayBuffer();
  } else {
    throw new Error("Este mensaje no tiene audio disponible.");
  }

  /* 3) Gemini multimodal: audio en base64 + salida JSON estructurada. */
  const base64 = Buffer.from(bytes).toString("base64");
  const prompt = [
    "Eres un asistente de un CRM de atención al cliente. Transcribe el siguiente audio de WhatsApp.",
    "Responde ÚNICAMENTE con un JSON válido con esta forma:",
    '{"transcript": "<transcripción textual completa en español>", "summary": "<resumen breve y neutral de 1-2 oraciones>", "flagged": <true si contiene lenguaje ofensivo, groserías o insultos; false en caso contrario>}',
  ].join(" ");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Gemini respondió con estado ${response.status}.`);
  const json = await response.json();
  const parsed = z.object({ candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1) }).parse(json);
  const raw = parsed.candidates[0]!.content.parts.map((part) => part.text ?? "").join("").trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const result = transcriptionSchema.parse(JSON.parse(cleaned));

  /* 4) Persistencia en el mensaje. */
  await admin.from("messages").update({
    audio_transcript: result.transcript.slice(0, 4000),
    audio_summary: result.summary.slice(0, 500),
    audio_moderation_flag: result.flagged,
  }).eq("id", messageId).eq("tenant_id", tenantId);

  return result;
}
