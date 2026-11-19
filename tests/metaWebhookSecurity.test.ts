import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/v1/webhooks/whatsapp/route";
import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";

const secret = "meta-test-secret";

afterEach(() => {
  delete process.env.META_APP_SECRET;
});

describe("TC-006 / TC-007 — firma del webhook de Meta", () => {
  it("acepta la firma HMAC-SHA256 del cuerpo original", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
    expect(isValidMetaSignature(body, signature, secret)).toBe(true);
  });

  it.each([null, "sha256=invalida", "sha1=abcd", "sha256="])("rechaza una firma inválida: %s", (signature) => {
    expect(isValidMetaSignature("{}", signature, secret)).toBe(false);
  });

  it("TC-006: el Route Handler responde 401 antes de consultar Supabase", async () => {
    process.env.META_APP_SECRET = secret;
    const request = new Request("http://localhost/api/v1/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=invalida" },
      body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Firma no válida." });
  });

  it("usa comparación segura solo cuando las longitudes coinciden", () => {
    expect(safeEqualSecret("mismo-token", "mismo-token")).toBe(true);
    expect(safeEqualSecret("token-a", "token-b")).toBe(false);
    expect(safeEqualSecret("corto", "mucho-mas-largo")).toBe(false);
  });
});
