import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/shared/lib/supabase/admin";

function nullableText(max: number) {
  return z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  ).transform((value) => value ?? null);
}

function nullableUrl() {
  return z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().url().max(2048).nullable().optional(),
  ).transform((value) => value ?? null);
}

const phoneSchema = z.string().trim().min(7).max(30).transform((value) => {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  return `+${digits}`;
}).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "phone_e164 debe incluir código de país."));

export const leadWebPayloadSchema = z.object({
  public_webhook_token: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/),
  full_name: z.string().trim().min(2).max(200),
  phone_e164: phoneSchema,
  email: z.union([z.string().trim().email().max(255), z.null(), z.undefined()]).transform((value) => value ?? null),
  company_name: nullableText(200),
  lead_source: z.string().trim().min(1).max(100).default("Formulario web"),
  utm_source: nullableText(150),
  utm_medium: nullableText(150),
  utm_campaign: nullableText(255),
  utm_content: nullableText(255),
  utm_term: nullableText(255),
  fbclid: nullableText(255),
  landing_url: nullableUrl(),
  referrer_url: nullableUrl(),
});

export type LeadWebPayload = z.infer<typeof leadWebPayloadSchema>;

export class InvalidPublicWebhookTokenError extends Error {
  constructor() {
    super("Token público de webhook no válido.");
    this.name = "InvalidPublicWebhookTokenError";
  }
}

export async function ingestLeadWebPayload(payload: LeadWebPayload) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ingest_web_lead", {
    p_public_webhook_token: payload.public_webhook_token,
    p_full_name: payload.full_name,
    p_phone_e164: payload.phone_e164,
    p_email: payload.email,
    p_company_name: payload.company_name,
    p_lead_source: payload.lead_source,
    p_utm_source: payload.utm_source,
    p_utm_medium: payload.utm_medium,
    p_utm_campaign: payload.utm_campaign,
    p_utm_content: payload.utm_content,
    p_utm_term: payload.utm_term,
    p_fbclid: payload.fbclid,
    p_landing_url: payload.landing_url,
    p_referrer_url: payload.referrer_url,
  });
  if (error?.code === "42501" || error?.message.includes("invalid_webhook_token")) {
    throw new InvalidPublicWebhookTokenError();
  }
  if (error) throw new Error(`Supabase RPC ingest_web_lead: ${error.message}`);

  const result = z.array(z.object({
    out_contact_id: z.string().uuid(),
    out_assigned_member_id: z.string().uuid().nullable(),
  })).length(1).parse(data);
  return result[0];
}
