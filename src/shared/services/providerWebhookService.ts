import "server-only";

import { createHmac, createPublicKey, verify as verifyEd25519 } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";
import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { ResolvedTenantIntegration, WebhookProvider } from "@/shared/services/tenantIntegrationService";
import { credential, publicCredential } from "@/shared/services/tenantIntegrationService";
import { parseWebhookJson, readWebhookBody, WebhookHttpError } from "@/shared/services/webhookHttp";

const MAX_BODY_BYTES = 1_000_000;
const phoneSchema = z.string().trim().min(7).max(30).transform((value) => `+${value.replace(/\D/g, "").replace(/^00/, "")}`)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const leadSchema = z.object({
  event_id: z.string().trim().min(1).max(300), account_id: z.string().trim().min(1).max(300),
  full_name: z.string().trim().min(1).max(200), phone_e164: phoneSchema,
  email: z.string().trim().email().max(255).nullish().transform((value) => value ?? null),
  company_name: optionalText(200), message: optionalText(4096),
  lead_source: z.string().trim().min(1).max(100).optional(), utm_source: optionalText(150),
  utm_medium: optionalText(150), utm_campaign: optionalText(255), utm_content: optionalText(255),
  utm_term: optionalText(255), fbclid: optionalText(255), landing_url: optionalText(2048), referrer_url: optionalText(2048),
});
type ProviderLead = z.infer<typeof leadSchema>;

const PROVIDER_SOURCES: Record<Exclude<WebhookProvider, "whatsapp">, string> = {
  "facebook-leads": "Meta Ads", instagram: "Instagram", "tiktok-ads": "TikTok Ads", twilio: "Twilio", telnyx: "Telnyx",
};

async function ingestLead(integration: ResolvedTenantIntegration, provider: Exclude<WebhookProvider, "whatsapp">, lead: ProviderLead) {
  const { data, error } = await createAdminClient().rpc("ingest_tenant_lead", {
    p_tenant_id: integration.tenant_id, p_provider: integration.provider, p_event_id: lead.event_id,
    p_full_name: lead.full_name, p_phone_e164: lead.phone_e164, p_email: lead.email,
    p_company_name: lead.company_name, p_lead_source: lead.lead_source ?? PROVIDER_SOURCES[provider],
    p_utm_source: lead.utm_source ?? provider, p_utm_medium: lead.utm_medium,
    p_utm_campaign: lead.utm_campaign, p_utm_content: lead.utm_content, p_utm_term: lead.utm_term,
    p_fbclid: lead.fbclid, p_landing_url: lead.landing_url, p_referrer_url: lead.referrer_url,
    p_message: lead.message,
  });
  if (error) throw new Error(`Supabase RPC ingest_tenant_lead: ${error.message}`);
  return z.array(z.object({ out_contact_id: z.string().uuid(), out_assigned_member_id: z.string().uuid().nullable() })).length(1).parse(data)[0];
}

function verifyAccount(lead: ProviderLead, expectedAccountId: string) {
  if (!expectedAccountId || lead.account_id !== expectedAccountId) throw new WebhookHttpError("La cuenta del evento no pertenece a este workspace.", 403);
}

function parseNormalizedLead(rawBody: string, expectedAccountId: string): ProviderLead {
  const parsed = leadSchema.safeParse(parseWebhookJson(rawBody));
  if (!parsed.success) throw new WebhookHttpError("Lead o mensaje no válido; se requieren event_id, account_id, full_name y phone_e164.", 400);
  verifyAccount(parsed.data, expectedAccountId);
  return parsed.data;
}

async function graphLead(leadgenId: string, accessToken: string): Promise<Record<string, unknown>> {
  const fields = "field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform";
  const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Meta respondió con estado ${response.status} al consultar el lead.`);
  return await response.json() as Record<string, unknown>;
}

async function parseMetaLead(rawBody: string, integration: ResolvedTenantIntegration, provider: "facebook-leads" | "instagram"): Promise<ProviderLead> {
  const expectedPageId = publicCredential(integration, "page_id");
  const json = parseWebhookJson(rawBody);
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new WebhookHttpError("Evento de Meta no válido.", 400);
  const body = json as Record<string, unknown>;
  if (!Array.isArray(body.entry)) return parseNormalizedLead(rawBody, expectedPageId);
  const entry = z.object({ entry: z.array(z.object({ changes: z.array(z.object({
    field: z.literal("leadgen"), value: z.object({ leadgen_id: z.string().min(1).max(150), page_id: z.string().min(1).max(150) }).passthrough(),
  }).passthrough()).max(100) }).passthrough()).max(100) }).safeParse(body);
  const change = entry.success ? entry.data.entry[0]?.changes[0] : undefined;
  if (!change) throw new WebhookHttpError("Evento de lead de Meta no válido.", 400);
  if (change.value.page_id !== expectedPageId) throw new WebhookHttpError("La página no pertenece a este workspace.", 403);
  const remote = await graphLead(change.value.leadgen_id, credential(integration, "access_token"));
  const fields = z.object({ field_data: z.array(z.object({ name: z.string(), values: z.array(z.string()).min(1) })).default([]) }).passthrough().parse(remote);
  const values = Object.fromEntries(fields.field_data.map((field) => [field.name, field.values[0]!]));
  const campaign = typeof remote.campaign_name === "string" ? remote.campaign_name : typeof remote.campaign_id === "string" ? remote.campaign_id : null;
  const ad = typeof remote.ad_name === "string" ? remote.ad_name : typeof remote.ad_id === "string" ? remote.ad_id : null;
  const lead = leadSchema.safeParse({
    event_id: change.value.leadgen_id, account_id: change.value.page_id,
    full_name: values.full_name ?? values.name, phone_e164: values.phone_number ?? values.phone ?? values.mobile,
    email: values.email, company_name: values.company_name, lead_source: "Meta Ads",
    utm_source: provider === "facebook-leads" ? "facebook" : "instagram", utm_medium: "paid_social",
    utm_campaign: campaign, utm_term: ad, fbclid: values.fbclid,
  });
  if (!lead.success) throw new WebhookHttpError("El lead de Meta no incluye nombre y teléfono válidos.", 422);
  return lead.data;
}

function verifyTwilio(request: Request, rawBody: string, authToken: string): URLSearchParams {
  const params = new URLSearchParams(rawBody);
  const url = new URL(request.url);
  const publicUrl = `${getAppOrigin(request)}${url.pathname}${url.search}`;
  const sorted = [...params.entries()].sort(([left], [right]) => left.localeCompare(right));
  const signed = sorted.reduce((value, [key, item]) => value + key + item, publicUrl);
  const expected = createHmac("sha1", authToken).update(signed, "utf8").digest("base64");
  const signature = request.headers.get("x-twilio-signature");
  if (!signature || !safeEqualSecret(signature, expected)) throw new WebhookHttpError("Firma de Twilio no válida.", 401);
  return params;
}

function verifyTelnyx(request: Request, rawBody: string, publicKey: string) {
  const signature = request.headers.get("telnyx-signature-ed25519");
  const timestamp = request.headers.get("telnyx-timestamp");
  if (!signature || !timestamp || !/^\d{1,12}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new WebhookHttpError("Firma o timestamp de Telnyx no válido.", 401);
  }
  try {
    const keyBytes = Buffer.from(publicKey, "base64");
    if (keyBytes.length !== 32) throw new Error("invalid key");
    const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), keyBytes]);
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    if (!verifyEd25519(null, Buffer.from(`${timestamp}|${rawBody}`, "utf8"), key, Buffer.from(signature, "base64"))) {
      throw new WebhookHttpError("Firma de Telnyx no válida.", 401);
    }
  } catch (error) {
    if (error instanceof WebhookHttpError) throw error;
    throw new WebhookHttpError("No se pudo validar la firma de Telnyx.", 401);
  }
}

function twilioLead(params: URLSearchParams, expectedAccountId: string): ProviderLead {
  const lead = leadSchema.safeParse({
    event_id: params.get("MessageSid") ?? params.get("CallSid"), account_id: params.get("AccountSid"),
    full_name: params.get("ProfileName") ?? `Twilio ${params.get("From") ?? ""}`,
    phone_e164: params.get("From"), message: params.get("Body"), utm_source: "twilio",
  });
  if (!lead.success) throw new WebhookHttpError("Mensaje de Twilio no válido o sin teléfono.", 400);
  verifyAccount(lead.data, expectedAccountId);
  return lead.data;
}

function telnyxLead(rawBody: string, expectedProfileId: string): ProviderLead | null {
  const parsed = z.object({ data: z.object({
    id: z.string().min(1).max(300), event_type: z.string().max(100),
    payload: z.object({
      id: z.string().min(1).max(300).optional(), messaging_profile_id: z.string().max(300),
      from: z.object({ phone_number: z.string().max(30) }).passthrough(), text: z.string().max(4096).optional(),
    }).passthrough(),
  }).passthrough() }).passthrough().safeParse(parseWebhookJson(rawBody));
  if (!parsed.success) throw new WebhookHttpError("Evento de Telnyx no válido.", 400);
  if (parsed.data.data.payload.messaging_profile_id !== expectedProfileId) throw new WebhookHttpError("El Messaging Profile no pertenece a este workspace.", 403);
  if (parsed.data.data.event_type !== "message.received") return null;
  const payload = parsed.data.data.payload;
  const lead = leadSchema.safeParse({
    event_id: payload.id ?? parsed.data.data.id, account_id: payload.messaging_profile_id,
    full_name: `Telnyx ${payload.from.phone_number}`, phone_e164: payload.from.phone_number,
    message: payload.text ?? "", utm_source: "telnyx",
  });
  if (!lead.success) throw new WebhookHttpError("Mensaje de Telnyx sin teléfono válido.", 400);
  return lead.data;
}

export async function handleProviderPost(request: Request, integration: ResolvedTenantIntegration, provider: Exclude<WebhookProvider, "whatsapp">) {
  const rawBody = await readWebhookBody(request, MAX_BODY_BYTES);
  let lead: ProviderLead | null;
  if (provider === "facebook-leads" || provider === "instagram") {
    if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), credential(integration, "app_secret"))) {
      throw new WebhookHttpError("Firma de Meta no válida.", 401);
    }
    lead = await parseMetaLead(rawBody, integration, provider);
  } else if (provider === "tiktok-ads") {
    const supplied = request.headers.get("x-tiktok-signature")?.replace(/^sha256=/, "") ?? "";
    const expected = createHmac("sha256", credential(integration, "webhook_secret")).update(rawBody, "utf8").digest("hex");
    if (!supplied || !safeEqualSecret(supplied, expected)) throw new WebhookHttpError("Firma de TikTok no válida.", 401);
    lead = parseNormalizedLead(rawBody, publicCredential(integration, "advertiser_id"));
  } else if (provider === "twilio") {
    const params = verifyTwilio(request, rawBody, credential(integration, "auth_token"));
    lead = twilioLead(params, publicCredential(integration, "account_sid"));
  } else {
    verifyTelnyx(request, rawBody, credential(integration, "public_key"));
    lead = telnyxLead(rawBody, publicCredential(integration, "messaging_profile_id"));
  }
  if (!lead) return NextResponse.json({ ok: true, accepted: true, ignored: 1 });
  const result = await ingestLead(integration, provider, lead);
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
