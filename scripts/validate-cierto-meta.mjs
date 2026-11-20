import { createDecipheriv, createHmac, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const TENANT_ID = "55cc06d8-a9cc-4ebc-a786-4266ba68dfbf";
const PROVIDER = "whatsapp_cloud_api";
const ORIGIN = "https://adlive-crm.vercel.app";
const CALLBACK = `${ORIGIN}/api/v1/${TENANT_ID}/whatsapp/webhooks`;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CIERTO_ENV_MISSING_${name}`);
  return value;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function decryptCredentials(payload) {
  const encoded = requiredEnv("ENCRYPTION_MASTER_KEY");
  const key = /^[a-fA-F0-9]{64}$/.test(encoded) ? Buffer.from(encoded, "hex") : Buffer.from(encoded, "base64");
  assert(key.length === 32, "CIERTO_INVALID_MASTER_KEY_LENGTH");
  const [version, ivPart, tagPart, encryptedPart, ...extra] = payload.split(".");
  assert(version === "v1" && ivPart && tagPart && encryptedPart !== undefined && extra.length === 0, "CIERTO_INVALID_VAULT_FORMAT");
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(`${TENANT_ID}:${PROVIDER}`, "utf8"));
  decipher.setAuthTag(authTag);
  const credentials = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8"));
  assert(credentials && typeof credentials === "object" && !Array.isArray(credentials), "CIERTO_INVALID_CREDENTIALS");
  return credentials;
}

async function fetchChecked(url, init, code) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch {
    throw new Error(code);
  }
}

async function postWebhook(rawBody, secret, validSignature = true) {
  const signature = createHmac("sha256", validSignature ? secret : randomBytes(32)).update(rawBody).digest("hex");
  return fetchChecked(CALLBACK, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` },
    body: rawBody,
  }, "CIERTO_WEBHOOK_NETWORK_FAILED");
}

async function run() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("CIERTO_VALIDATION_SKIPPED_NON_PRODUCTION");
    return;
  }

  const admin = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: record, error } = await admin.from("tenant_integrations_vault")
    .select("encrypted_credentials,public_metadata")
    .eq("tenant_id", TENANT_ID)
    .eq("provider", PROVIDER)
    .eq("is_connected", true)
    .maybeSingle();
  assert(!error && record, "CIERTO_VAULT_READ_FAILED");
  const credentials = decryptCredentials(record.encrypted_credentials);
  const accessToken = credentials.access_token?.trim();
  const appSecret = credentials.app_secret?.trim();
  const verifyToken = credentials.verify_token?.trim();
  const phoneNumberId = record.public_metadata?.phone_number_id?.trim();
  const wabaId = record.public_metadata?.waba_id?.trim();
  assert(accessToken && appSecret && verifyToken && phoneNumberId && wabaId, "CIERTO_CONFIGURATION_INCOMPLETE");

  const challenge = randomBytes(24).toString("hex");
  const challengeUrl = new URL(CALLBACK);
  challengeUrl.searchParams.set("hub.mode", "subscribe");
  challengeUrl.searchParams.set("hub.verify_token", verifyToken);
  challengeUrl.searchParams.set("hub.challenge", challenge);
  const validChallenge = await fetchChecked(challengeUrl, undefined, "CIERTO_CHALLENGE_NETWORK_FAILED");
  assert(validChallenge.status === 200 && await validChallenge.text() === challenge, "CIERTO_VALID_CHALLENGE_REJECTED");

  const invalidChallengeUrl = new URL(challengeUrl);
  invalidChallengeUrl.searchParams.set("hub.verify_token", randomBytes(32).toString("hex"));
  const invalidChallenge = await fetchChecked(invalidChallengeUrl, undefined, "CIERTO_CHALLENGE_NETWORK_FAILED");
  assert(invalidChallenge.status === 403, "CIERTO_INVALID_CHALLENGE_NOT_REJECTED");

  const emptyPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const validPost = await postWebhook(emptyPayload, appSecret);
  assert(validPost.status === 200, "CIERTO_VALID_SIGNATURE_REJECTED");
  const invalidPost = await postWebhook(emptyPayload, appSecret, false);
  assert(invalidPost.status === 401, "CIERTO_INVALID_SIGNATURE_NOT_REJECTED");

  const foreignPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: wabaId,
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: "000000000000000", display_phone_number: "000000000000000" },
          messages: [],
        },
      }],
    }],
  });
  const foreignPost = await postWebhook(foreignPayload, appSecret);
  assert(foreignPost.status === 403, "CIERTO_FOREIGN_PHONE_NOT_REJECTED");

  const graphHeaders = { Authorization: `Bearer ${accessToken}` };
  const phoneResponse = await fetchChecked(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number`,
    { headers: graphHeaders },
    "CIERTO_GRAPH_PHONE_NETWORK_FAILED",
  );
  const phoneBody = await phoneResponse.json().catch(() => null);
  assert(phoneResponse.ok && phoneBody?.id === phoneNumberId, "CIERTO_GRAPH_PHONE_REJECTED");

  const appsResponse = await fetchChecked(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(wabaId)}/subscribed_apps`,
    { headers: graphHeaders },
    "CIERTO_GRAPH_APPS_NETWORK_FAILED",
  );
  const appsBody = await appsResponse.json().catch(() => null);
  assert(appsResponse.ok && Array.isArray(appsBody?.data), "CIERTO_GRAPH_APPS_REJECTED");
  const subscribedAppIds = appsBody.data.map((app) => app?.id).filter((id) => typeof id === "string");
  assert(subscribedAppIds.length > 0, "CIERTO_NO_SUBSCRIBED_APP");

  console.log("CIERTO_EXTERNAL_VALIDATION_RESULT", JSON.stringify({
    validChallenge: true,
    invalidChallengeRejected: true,
    validSignatureAccepted: true,
    invalidSignatureRejected: true,
    foreignPhoneRejected: true,
    graphPhoneConnected: true,
    wabaSubscriptionPresent: true,
    subscribedAppIds,
    persistentTestDataCreated: false,
    realMetaDeliveryObserved: false,
    dashboardCallbackVerified: false,
  }));
}

run().catch((error) => {
  const message = error instanceof Error && /^CIERTO_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "CIERTO_UNEXPECTED_VALIDATION_FAILURE";
  console.error(message);
  process.exitCode = 1;
});
