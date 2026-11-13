import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const FORMAT_VERSION = "v1";

function getMasterKey(): Buffer {
  const encoded = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!encoded) throw new Error("Vault cipher: falta ENCRYPTION_MASTER_KEY.");

  const isHex = /^[a-fA-F0-9]{64}$/.test(encoded);
  const key = isHex ? Buffer.from(encoded, "hex") : Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("Vault cipher: ENCRYPTION_MASTER_KEY debe contener exactamente 32 bytes en Base64 o hexadecimal.");
  }
  return key;
}

/** Cifra texto con IV aleatorio, tag GCM y AAD opcional (tenant/proveedor). */
export function encryptVaultText(plainText: string, additionalAuthenticatedData?: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv, { authTagLength: AUTH_TAG_BYTES });
  if (additionalAuthenticatedData) cipher.setAAD(Buffer.from(additionalAuthenticatedData, "utf8"));

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Descifra únicamente el formato versionado emitido por encryptVaultText. */
export function decryptVaultText(payload: string, additionalAuthenticatedData?: string): string {
  const [version, ivPart, tagPart, encryptedPart, ...extra] = payload.split(".");
  if (version !== FORMAT_VERSION || !ivPart || !tagPart || encryptedPart === undefined || extra.length > 0) {
    throw new Error("Vault cipher: formato de credencial cifrada no válido.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Vault cipher: IV o tag de autenticación no válido.");
  }

  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), iv, { authTagLength: AUTH_TAG_BYTES });
  if (additionalAuthenticatedData) decipher.setAAD(Buffer.from(additionalAuthenticatedData, "utf8"));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function encryptVaultCredentials(credentials: Record<string, string>, tenantId: string, provider: string): string {
  return encryptVaultText(JSON.stringify(credentials), `${tenantId}:${provider}`);
}

export function decryptVaultCredentials(payload: string, tenantId: string, provider: string): Record<string, string> {
  const parsed: unknown = JSON.parse(decryptVaultText(payload, `${tenantId}:${provider}`));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Vault cipher: las credenciales descifradas no son un objeto.");
  }

  const entries = Object.entries(parsed);
  if (entries.some(([, value]) => typeof value !== "string")) {
    throw new Error("Vault cipher: todas las credenciales deben ser cadenas de texto.");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
