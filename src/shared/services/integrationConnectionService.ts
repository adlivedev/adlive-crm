import "server-only";

import type { IntegrationProvider } from "@/shared/types/database";
import { credential, getTenantIntegration, publicCredential } from "@/shared/services/tenantIntegrationService";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function checkedFetch(url: string, init: RequestInit, label: string): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${label} respondió con estado ${response.status}. Revisa las credenciales.`);
  if (!body) return {};
  try { return JSON.parse(body) as unknown; } catch { return {}; }
}

function encoded(value: string): string {
  if (!value) throw new Error("La configuración de la integración está incompleta.");
  return encodeURIComponent(value);
}

export async function testTenantConnection(tenantId: string, provider: IntegrationProvider): Promise<void> {
  const integration = await getTenantIntegration(tenantId, provider);
  if (!integration) throw new Error("La integración no está conectada para este workspace.");
  const token = credential(integration, "access_token");

  if (provider === "whatsapp_cloud_api") {
    const phoneNumberId = publicCredential(integration, "phone_number_id");
    await checkedFetch(`${GRAPH_BASE}/${encoded(phoneNumberId)}?fields=id,display_phone_number`, {
      headers: { Authorization: `Bearer ${token}` },
    }, "Meta");
    return;
  }
  if (provider === "facebook_lead_ads") {
    const pageId = publicCredential(integration, "page_id");
    await checkedFetch(`${GRAPH_BASE}/${encoded(pageId)}?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` },
    }, "Meta");
    return;
  }
  if (provider === "instagram") {
    const instagramId = publicCredential(integration, "ig_user_id");
    await checkedFetch(`${GRAPH_BASE}/${encoded(instagramId)}?fields=id,username`, {
      headers: { Authorization: `Bearer ${token}` },
    }, "Meta");
    return;
  }
  if (provider === "tiktok_ads") {
    const advertiserId = encoded(publicCredential(integration, "advertiser_id"));
    const ids = encodeURIComponent(JSON.stringify([decodeURIComponent(advertiserId)]));
    await checkedFetch(`https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${ids}`, {
      headers: { "Access-Token": token },
    }, "TikTok");
    return;
  }
  if (provider === "twilio") {
    const accountSid = publicCredential(integration, "account_sid");
    const authToken = credential(integration, "auth_token");
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    await checkedFetch(`https://api.twilio.com/2010-04-01/Accounts/${encoded(accountSid)}.json`, {
      headers: { Authorization: `Basic ${basic}` },
    }, "Twilio");
    return;
  }

  const profileId = publicCredential(integration, "messaging_profile_id");
  const apiKey = credential(integration, "api_key");
  await checkedFetch(`https://api.telnyx.com/v2/messaging_profiles/${encoded(profileId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, "Telnyx");
}
