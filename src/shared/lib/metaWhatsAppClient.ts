import "server-only";

import { z } from "zod";

import { decryptVaultCredentials } from "@/shared/lib/crypto/vaultCipher";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { WhatsAppTemplateButton } from "@/shared/types/database";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface WhatsAppConfig { accessToken: string; phoneNumberId: string; wabaId: string }
export interface MetaTemplateInput {
  name: string; category: "MARKETING" | "UTILITY" | "AUTHENTICATION"; language: string;
  body_text: string; footer_text?: string | null; variables_count: number;
  header_type?: "NONE" | "TEXT" | "IMAGE"; header_content?: string | null;
  buttons?: WhatsAppTemplateButton[];
}

async function config(tenantId: string): Promise<WhatsAppConfig> {
  const { data, error } = await createAdminClient().from("tenant_integrations_vault")
    .select("public_metadata,encrypted_credentials").eq("tenant_id", tenantId)
    .eq("provider", "whatsapp_cloud_api").eq("is_connected", true).single();
  if (error || !data) throw new Error("WhatsApp Cloud API no está conectado para este workspace.");
  const credentials = decryptVaultCredentials(data.encrypted_credentials, tenantId, "whatsapp_cloud_api");
  const accessToken = credentials.access_token?.trim();
  const phoneNumberId = typeof data.public_metadata?.phone_number_id === "string" ? data.public_metadata.phone_number_id : "";
  const wabaId = typeof data.public_metadata?.waba_id === "string" ? data.public_metadata.waba_id : "";
  if (!accessToken || !phoneNumberId || !wabaId) throw new Error("La configuración de WhatsApp está incompleta.");
  return { accessToken, phoneNumberId, wabaId };
}

async function graph<T>(path: string, accessToken: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init, signal: AbortSignal.timeout(15_000), cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = z.object({ error: z.object({ message: z.string() }).optional() }).safeParse(json);
    throw new Error(message.success && message.data.error ? `Meta: ${message.data.error.message.slice(0, 300)}` : `Meta respondió con estado ${response.status}.`);
  }
  return schema.parse(json);
}

export async function sendMetaText(tenantId: string, to: string, body: string): Promise<string> {
  const settings = await config(tenantId);
  const result = await graph(`/${settings.phoneNumberId}/messages`, settings.accessToken, {
    method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""), type: "text", text: { preview_url: false, body } }),
  }, z.object({ messages: z.array(z.object({ id: z.string() })).min(1) }));
  return result.messages[0]!.id;
}

export async function sendMetaTemplate(tenantId: string, to: string, template: { name: string; language: string }, variables: string[]): Promise<string> {
  const settings = await config(tenantId);
  const components = variables.length > 0 ? [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] : [];
  const result = await graph(`/${settings.phoneNumberId}/messages`, settings.accessToken, {
    method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""), type: "template", template: { name: template.name, language: { code: template.language }, components } }),
  }, z.object({ messages: z.array(z.object({ id: z.string() })).min(1) }));
  return result.messages[0]!.id;
}

/** Envía una imagen por URL pública (Supabase Storage) con pie de foto opcional. */
export async function sendMetaImage(tenantId: string, to: string, imageUrl: string, caption: string | null): Promise<string> {
  const settings = await config(tenantId);
  const result = await graph(`/${settings.phoneNumberId}/messages`, settings.accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""),
      type: "image", image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  }, z.object({ messages: z.array(z.object({ id: z.string() })).min(1) }));
  return result.messages[0]!.id;
}

export interface MetaInteractiveButton { kind: "reply" | "cta_url"; title: string; url?: string }
export interface MetaInteractiveInput {
  body: string; footer?: string | null; headerImageUrl?: string | null; buttons: MetaInteractiveButton[];
}

/** Envía un mensaje interactivo tipo botones (máx. 3 respuestas rápidas o 1 CTA con enlace). */
export async function sendMetaInteractive(tenantId: string, to: string, input: MetaInteractiveInput): Promise<string> {
  const settings = await config(tenantId);
  const cta = input.buttons.find((button) => button.kind === "cta_url");
  const action = cta
    ? { name: "cta_url", parameters: { display_text: cta.title.slice(0, 20), url: cta.url ?? "" } }
    : {
        buttons: input.buttons.slice(0, 3).map((button, index) => ({
          type: "reply", reply: { id: `btn_${index + 1}`, title: button.title.slice(0, 20) },
        })),
      };
  const interactive: Record<string, unknown> = {
    type: "button",
    body: { text: input.body.slice(0, 1024) },
    action,
  };
  if (input.footer) interactive.footer = { text: input.footer.slice(0, 60) };
  if (input.headerImageUrl) interactive.header = { type: "image", image: { link: input.headerImageUrl } };
  const result = await graph(`/${settings.phoneNumberId}/messages`, settings.accessToken, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""), type: "interactive", interactive }),
  }, z.object({ messages: z.array(z.object({ id: z.string() })).min(1) }));
  return result.messages[0]!.id;
}

/** Sube un archivo de imagen al servidor de medios de Meta y devuelve el media id (para headers de plantilla). */
export async function uploadMetaMedia(tenantId: string, imageUrl: string, mimeType: string): Promise<string> {
  const settings = await config(tenantId);
  const remote = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!remote.ok) throw new Error("No se pudo descargar la imagen del almacenamiento para enviarla a Meta.");
  const blob = await remote.blob();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([blob], { type: mimeType }), "header");
  const response = await fetch(`${GRAPH_BASE}/${settings.phoneNumberId}/media`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    body: form,
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = z.object({ error: z.object({ message: z.string() }).optional() }).safeParse(json);
    throw new Error(message.success && message.data.error ? `Meta: ${message.data.error.message.slice(0, 300)}` : `Meta respondió con estado ${response.status} al subir el medio.`);
  }
  return z.object({ id: z.string() }).parse(json).id;
}

export async function createMetaTemplate(tenantId: string, input: MetaTemplateInput & { headerMediaHandle?: string | null }): Promise<string> {
  const settings = await config(tenantId);
  const components: Array<Record<string, unknown>> = [{ type: "BODY", text: input.body_text }];
  if (input.header_type === "TEXT" && input.header_content) components.push({ type: "HEADER", format: "TEXT", text: input.header_content });
  if (input.header_type === "IMAGE") {
    if (!input.headerMediaHandle) throw new Error("Meta exige subir la imagen del header al crear la plantilla.");
    components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [input.headerMediaHandle] } });
  }
  if (input.footer_text) components.push({ type: "FOOTER", text: input.footer_text });
  const buttons = (input.buttons ?? []).map((button) => button.type === "QUICK_REPLY"
    ? { type: button.type, text: button.text }
    : button.type === "URL" ? { type: button.type, text: button.text, url: button.url } : { type: button.type, text: button.text, phone_number: button.phone_number });
  if (buttons.length > 0) components.push({ type: "BUTTONS", buttons });
  const result = await graph(`/${settings.wabaId}/message_templates`, settings.accessToken, {
    method: "POST", body: JSON.stringify({ name: input.name, category: input.category, language: input.language, components }),
  }, z.object({ id: z.string() }));
  return result.id;
}

const remoteTemplateSchema = z.object({ data: z.array(z.object({
  id: z.string(), name: z.string(), status: z.string(), category: z.string(), language: z.string(),
  components: z.array(z.object({ type: z.string(), format: z.string().optional(), text: z.string().optional(), buttons: z.array(z.unknown()).optional() }).passthrough()).optional(),
}).passthrough()) });

/** Descarga multimedia entrante: la URL temporal de Meta expira en minutos, por eso se resuelve bajo demanda. */
export async function downloadMetaMedia(tenantId: string, mediaId: string): Promise<Response> {
  if (!/^\d{1,40}$/.test(mediaId)) throw new Error("Identificador de multimedia no válido.");
  const settings = await config(tenantId);
  const location = await graph(`/${mediaId}`, settings.accessToken, { method: "GET" }, z.object({ url: z.string().url() }));
  return fetch(location.url, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
}

export async function listMetaTemplates(tenantId: string) {
  const settings = await config(tenantId);
  const result = await graph(`/${settings.wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components`, settings.accessToken, { method: "GET" }, remoteTemplateSchema);
  return result.data;
}
