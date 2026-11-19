import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqualSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/** Verifica X-Hub-Signature-256 sobre el cuerpo original, sin parsearlo. */
export function isValidMetaSignature(rawBody: string, signature: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqualSecret(signature, expected);
}
