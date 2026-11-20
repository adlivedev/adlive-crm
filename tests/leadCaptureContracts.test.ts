import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20261120000400_tenant_lead_capture.sql"), "utf8");

describe("Contratos del motor de captura", () => {
  it("exige tenant y token y mantiene la ingesta legacy", async () => {
    expect(migration).toContain("tenant.id = p_tenant_id");
    expect(migration).toContain("tenant.public_webhook_token = p_public_webhook_token");
    expect(migration).toContain("tenant.status = 'active'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.ingest_tenant_web_lead");
    const { leadWebPayloadSchema, tenantLeadWebPayloadSchema } = await import("@/shared/services/leadWebhookService");
    const legacy = leadWebPayloadSchema.safeParse({ public_webhook_token: "1234567890abcdef", full_name: "Lead Legacy", phone_e164: "+573001112233" });
    const current = tenantLeadWebPayloadSchema.safeParse({ token: "1234567890abcdef", first_name: "Lead", last_name: "Actual", phone: "+573001112233" });
    expect(legacy.success).toBe(true);
    expect(current.success).toBe(true);
  });

  it("combina campos personalizados y selecciona Interesado con fallback abierto", () => {
    expect(migration).toContain("contacts.custom_fields || EXCLUDED.custom_fields");
    expect(migration).toContain("INSERT INTO public.contacts");
    expect(migration).toContain("LOWER(BTRIM(stage.name)) = 'interesado'");
    expect(migration).toContain("CASE WHEN stage.stage_category = 'open' THEN 0 ELSE 1 END");
    expect(migration).toContain("INSERT INTO public.opportunities");
    expect(migration).toContain("AND opportunity.status = 'open'");
  });

  it("permite frames solo en landings y formularios públicos", async () => {
    if (!nextConfig.headers) throw new Error("Faltan cabeceras de seguridad");
    const entries = await nextConfig.headers();
    const crm = entries.find((entry) => entry.source === "/((?!l/|embed/).*)");
    const landing = entries.find((entry) => entry.source === "/l/:path*");
    const embed = entries.find((entry) => entry.source === "/embed/:path*");
    expect(crm?.headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    for (const entry of [landing, embed]) {
      expect(entry?.headers).toContainEqual({ key: "Content-Security-Policy", value: "frame-ancestors *" });
      expect(entry?.headers.some((header) => header.key === "X-Frame-Options")).toBe(false);
    }
  });
});
