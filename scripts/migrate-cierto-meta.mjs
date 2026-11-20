import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const TENANT_ID = "55cc06d8-a9cc-4ebc-a786-4266ba68dfbf";
const PROVIDER = "whatsapp_cloud_api";
const AAD = `${TENANT_ID}:${PROVIDER}`;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CIERTO_ENV_MISSING_${name}`);
  return value;
}

function masterKey() {
  const encoded = requiredEnv("ENCRYPTION_MASTER_KEY");
  const key = /^[a-fA-F0-9]{64}$/.test(encoded) ? Buffer.from(encoded, "hex") : Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("CIERTO_INVALID_MASTER_KEY_LENGTH");
  return key;
}

function decryptCredentials(payload) {
  const [version, ivPart, tagPart, encryptedPart, ...extra] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || encryptedPart === undefined || extra.length > 0) {
    throw new Error("CIERTO_INVALID_VAULT_FORMAT");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  if (iv.length !== 12 || authTag.length !== 16) throw new Error("CIERTO_INVALID_VAULT_PARAMETERS");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(AAD, "utf8"));
  decipher.setAuthTag(authTag);
  const plainText = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const credentials = JSON.parse(plainText);
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    throw new Error("CIERTO_INVALID_DECRYPTED_CREDENTIALS");
  }
  if (Object.values(credentials).some((value) => typeof value !== "string")) {
    throw new Error("CIERTO_NON_STRING_CREDENTIAL");
  }
  return credentials;
}

function encryptCredentials(credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(AAD, "utf8"));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sameSecret(left, right) {
  if (!present(left) || !present(right)) return null;
  const leftDigest = Buffer.from(left.trim());
  const rightDigest = Buffer.from(right.trim());
  if (leftDigest.length !== rightDigest.length) return false;
  return timingSafeEqual(leftDigest, rightDigest);
}

async function run() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("CIERTO_MIGRATION_SKIPPED_NON_PRODUCTION");
    return;
  }

  const admin = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const selector = admin.from("tenant_integrations_vault")
    .select("id,encrypted_credentials,public_metadata")
    .eq("tenant_id", TENANT_ID)
    .eq("provider", PROVIDER)
    .eq("is_connected", true);
  const { data: record, error: readError } = await selector.maybeSingle();
  if (readError) throw new Error("CIERTO_VAULT_READ_FAILED");
  if (!record) throw new Error("CIERTO_CONNECTED_INTEGRATION_NOT_FOUND");

  const credentials = decryptCredentials(record.encrypted_credentials);
  const original = { ...credentials };
  let addedAppSecret = false;
  let addedVerifyToken = false;
  if (!present(credentials.app_secret)) {
    credentials.app_secret = requiredEnv("META_APP_SECRET");
    addedAppSecret = true;
  }
  if (!present(credentials.verify_token)) {
    credentials.verify_token = requiredEnv("WHATSAPP_VERIFY_TOKEN");
    addedVerifyToken = true;
  }
  if (!present(credentials.access_token)) throw new Error("CIERTO_ACCESS_TOKEN_MISSING");
  if (!present(record.public_metadata?.phone_number_id)) throw new Error("CIERTO_PHONE_NUMBER_ID_MISSING");

  let updated = false;
  if (addedAppSecret || addedVerifyToken) {
    const { data: saved, error: updateError } = await admin.from("tenant_integrations_vault")
      .update({ encrypted_credentials: encryptCredentials(credentials), updated_at: new Date().toISOString() })
      .eq("id", record.id)
      .eq("tenant_id", TENANT_ID)
      .eq("provider", PROVIDER)
      .select("encrypted_credentials")
      .single();
    if (updateError || !saved) throw new Error("CIERTO_VAULT_UPDATE_FAILED");
    updated = true;
  }

  const { data: readBack, error: readBackError } = await selector.maybeSingle();
  if (readBackError || !readBack) throw new Error("CIERTO_VAULT_READ_BACK_FAILED");
  const verified = decryptCredentials(readBack.encrypted_credentials);
  for (const [key, value] of Object.entries(original)) {
    if (verified[key] !== value) throw new Error("CIERTO_EXISTING_CREDENTIAL_CHANGED");
  }
  if (!present(verified.access_token) || !present(verified.app_secret) || !present(verified.verify_token)) {
    throw new Error("CIERTO_READ_BACK_INCOMPLETE");
  }

  console.log("CIERTO_MIGRATION_RESULT", JSON.stringify({
    accessTokenPresent: true,
    appSecretPresent: true,
    verifyTokenPresent: true,
    addedAppSecret,
    addedVerifyToken,
    updated,
    readBackVerified: true,
    appSecretMatchesLegacy: sameSecret(verified.app_secret, process.env.META_APP_SECRET),
    verifyTokenMatchesLegacy: sameSecret(verified.verify_token, process.env.WHATSAPP_VERIFY_TOKEN),
  }));
}

run().catch((error) => {
  const message = error instanceof Error && /^CIERTO_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "CIERTO_UNEXPECTED_MIGRATION_FAILURE";
  console.error(message);
  process.exitCode = 1;
});
