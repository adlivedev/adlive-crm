import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformSuperadmin: vi.fn(),
  requireTenantAdminOrPlatformSuperadmin: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
  encryptVaultText: vi.fn(),
  sendWorkspaceEmail: vi.fn(),
}));

vi.mock("@/shared/lib/serverAuth", () => ({
  requirePlatformSuperadmin: mocks.requirePlatformSuperadmin,
  requireTenantAdminOrPlatformSuperadmin: mocks.requireTenantAdminOrPlatformSuperadmin,
  authErrorStatus: (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    if (code === "UNAUTHORIZED") return 401;
    if (code === "FORBIDDEN") return 403;
    return 500;
  },
}));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({ encryptVaultText: mocks.encryptVaultText }));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));

import { GET as getSmtp, POST as postSmtp } from "@/app/api/v1/superadmin/smtp/route";
import { POST as uploadLogo } from "@/app/api/v1/tenants/branding/upload/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261120000100_saas_smtp_storage_landings.sql"), "utf8");

beforeEach(() => {
  mocks.requirePlatformSuperadmin.mockRejectedValue(new Error("UNAUTHORIZED"));
  mocks.requireTenantAdminOrPlatformSuperadmin.mockRejectedValue(new Error("FORBIDDEN"));
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.encryptVaultText.mockReturnValue("encrypted-smtp-password");
  mocks.sendWorkspaceEmail.mockResolvedValue(undefined);
});

describe("Gobernanza SaaS — contratos SQL", () => {
  it("bloquea SMTP a anon/authenticated y usa RLS sin políticas de cliente", () => {
    expect(sql).toContain("ALTER TABLE public.platform_smtp_settings ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("REVOKE ALL ON public.platform_smtp_settings FROM anon, authenticated;");
    expect(sql).toContain("GRANT ALL ON public.platform_smtp_settings TO service_role;");
    expect(sql).not.toContain("CREATE POLICY platform_smtp_settings");
  });

  it("crea landings multi-tenant y valores iniciales idempotentes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.tenant_landings");
    expect(sql).toContain("private.is_tenant_admin(tenant_id) OR public.is_platform_superadmin()");
    expect(sql).toContain("ON CONFLICT (tenant_id, slug) DO NOTHING;");
    expect(sql).toContain("('Interesado', 2, 'open'::public.stage_type)");
  });

  it("limita Storage a imágenes rasterizadas de 2 MB", () => {
    expect(sql).toContain("2097152");
    expect(sql).toContain("ARRAY['image/png', 'image/jpeg', 'image/webp']");
    expect(sql).not.toContain("image/svg+xml");
  });
});

describe("SMTP global — autorización y secreto", () => {
  it("rechaza GET sin sesión antes de abrir el cliente administrativo", async () => {
    const response = await getSmtp();
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("cifra la contraseña y responde solo has_password", async () => {
    mocks.requirePlatformSuperadmin.mockResolvedValue({ user: { id: "admin", email: "admin@adlive.test" } });
    const existingQuery = {
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      }),
    };
    const row = {
      id: "smtp-1", host: "smtp.test", port: 587, secure: false, username: "mailer",
      encrypted_password: "encrypted-smtp-password", from_name: "ADlive", from_email: "hola@adlive.test",
      is_active: true, updated_at: "2026-11-20T00:00:00Z",
    };
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: row, error: null }) }),
    });
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue(existingQuery), insert });

    const response = await postSmtp(new Request("http://localhost/api/v1/superadmin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save", host: "smtp.test", port: 587, secure: false, username: "mailer",
        password: "smtp-secret", from_name: "ADlive", from_email: "hola@adlive.test", is_active: true,
      }),
    }));
    const payload = await response.json() as { settings?: { has_password?: boolean } };

    expect(response.status).toBe(200);
    expect(mocks.encryptVaultText).toHaveBeenCalledWith("smtp-secret", "platform:smtp");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ encrypted_password: "encrypted-smtp-password" }));
    expect(payload.settings?.has_password).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("smtp-secret");
    expect(JSON.stringify(payload)).not.toContain("encrypted_password");
    expect(JSON.stringify(payload)).not.toContain("encrypted-smtp-password");
  });
});

describe("Subida de logos — frontera de archivo y permisos", () => {
  it("rechaza SVG antes de consultar autorización", async () => {
    const body = new FormData();
    body.append("tenantId", tenantId);
    body.append("variant", "logo_url");
    body.append("file", new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"/>"], "logo.svg", { type: "image/svg+xml" }));
    const response = await uploadLogo(new Request("http://localhost/api/v1/tenants/branding/upload", { method: "POST", body }));

    expect(response.status).toBe(400);
    expect(mocks.requireTenantAdminOrPlatformSuperadmin).not.toHaveBeenCalled();
  });

  it("exige owner/admin o superadmin incluso con firma PNG válida", async () => {
    const body = new FormData();
    body.append("tenantId", tenantId);
    body.append("variant", "logo_url");
    body.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", { type: "image/png" }));
    const response = await uploadLogo(new Request("http://localhost/api/v1/tenants/branding/upload", { method: "POST", body }));

    expect(response.status).toBe(403);
    expect(mocks.requireTenantAdminOrPlatformSuperadmin).toHaveBeenCalledWith(tenantId);
  });
});
