import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(),
  encryptVaultCredentials: vi.fn(), encryptVaultText: vi.fn(), sendWorkspaceEmail: vi.fn(),
  testTenantConnection: vi.fn(), unexpectedFrom: vi.fn(), tenantUpdate: vi.fn(), storageFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/crypto/vaultCipher", () => ({
  encryptVaultCredentials: mocks.encryptVaultCredentials,
  decryptVaultCredentials: vi.fn(),
  encryptVaultText: mocks.encryptVaultText,
}));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));
vi.mock("@/shared/services/integrationConnectionService", () => ({ testTenantConnection: mocks.testTenantConnection }));

import { DELETE as deleteIntegration, GET as getIntegrations, POST as postIntegration, PUT as putIntegration } from "@/app/api/v1/integrations/route";
import { GET as getAiProviders, POST as postAiProvider } from "@/app/api/v1/ai-bots/providers/route";
import { POST as inviteMember } from "@/app/api/v1/team/invite/route";
import { PATCH as patchBranding } from "@/app/api/v1/tenants/branding/route";
import { POST as uploadBranding } from "@/app/api/v1/tenants/branding/upload/route";
import { GET as getTenants, PATCH as patchTenant, POST as postTenant } from "@/app/api/v1/superadmin/tenants/route";
import { GET as getSmtp, POST as postSmtp } from "@/app/api/v1/superadmin/smtp/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const branding = {
  brand_name: "CIERTO", logo_url: null, logo_dark_url: null,
  primary_color: "#5B00FF", primary_hover: "#4400CC", accent_color: "#29C5F6",
  sidebar_bg: "#0A0A12", canvas_bg: "#F6F7FB", ink_color: "#18181B",
};

function json(url: string, method: string, body: Record<string, unknown>) {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function logoUpload() {
  const body = new FormData();
  body.append("tenantId", tenantId);
  body.append("variant", "logo_url");
  body.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", { type: "image/png" }));
  return new Request("http://localhost/api/v1/tenants/branding/upload", { method: "POST", body });
}

function memberQuery() {
  const filters: Record<string, unknown> = {};
  let allowedRoles: string[] | null = null;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { filters[column] = value; return query; }),
    in: vi.fn((column: string, values: string[]) => { if (column === "role") allowedRoles = values; return query; }),
    maybeSingle: vi.fn(async () => {
      const matches = filters.tenant_id === tenantId && filters.user_id === userId && filters.is_active === true
        && (allowedRoles === null || allowedRoles.includes("agent"));
      return { data: matches ? { id: "member-agent", tenant_id: tenantId, user_id: userId, role: "agent", is_active: true } : null, error: null };
    }),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "agente@cierto.test" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === "tenant_members") return memberQuery();
      mocks.unexpectedFrom(table);
      return { update: mocks.tenantUpdate };
    },
    storage: { from: mocks.storageFrom },
  });
});

const attacks: Array<[string, () => Promise<Response>]> = [
  ["GET /api/v1/integrations", () => getIntegrations(new Request(`http://localhost/api/v1/integrations?tenantId=${tenantId}`))],
  ["PUT /api/v1/integrations", () => putIntegration(json("http://localhost/api/v1/integrations", "PUT", { tenantId, provider: "whatsapp_cloud_api", credentials: { phone_number_id: "phone", waba_id: "waba", access_token: "token", app_secret: "secret" } }))],
  ["POST /api/v1/integrations", () => postIntegration(json("http://localhost/api/v1/integrations", "POST", { tenantId, provider: "whatsapp_cloud_api", action: "test" }))],
  ["DELETE /api/v1/integrations", () => deleteIntegration(json("http://localhost/api/v1/integrations", "DELETE", { tenantId, provider: "whatsapp_cloud_api" }))],
  ["GET /api/v1/ai-bots/providers", () => getAiProviders(new Request(`http://localhost/api/v1/ai-bots/providers?tenantId=${tenantId}`))],
  ["POST /api/v1/ai-bots/providers", () => postAiProvider(json("http://localhost/api/v1/ai-bots/providers", "POST", { tenantId, provider: "openai", apiKey: "test-api-key-123" }))],
  ["POST /api/v1/team/invite", () => inviteMember(json("http://localhost/api/v1/team/invite", "POST", { tenantId, email: "nuevo@cierto.test", role: "agent" }))],
  ["PATCH /api/v1/tenants/branding", () => patchBranding(json("http://localhost/api/v1/tenants/branding", "PATCH", { tenantId, branding }))],
  ["POST /api/v1/tenants/branding/upload", () => uploadBranding(logoUpload())],
  ["GET /api/v1/superadmin/tenants", () => getTenants()],
  ["POST /api/v1/superadmin/tenants", () => postTenant(json("http://localhost/api/v1/superadmin/tenants", "POST", { name: "Empresa nueva", slug: "empresa-nueva", adminEmail: "owner@empresa.test", branding }))],
  ["PATCH /api/v1/superadmin/tenants", () => patchTenant(json("http://localhost/api/v1/superadmin/tenants", "PATCH", { tenantId, status: "suspended" }))],
  ["GET /api/v1/superadmin/smtp", () => getSmtp()],
  ["POST /api/v1/superadmin/smtp", () => postSmtp(json("http://localhost/api/v1/superadmin/smtp", "POST", { action: "save", host: "smtp.test", port: 587, secure: false, username: "mailer", password: "test-password", from_name: "ADlive", from_email: "hola@adlive.test", is_active: true }))],
];

describe("TC-RBAC — un agente autenticado del tenant no puede elevar privilegios", () => {
  it.each(attacks)("%s responde 403 antes de cualquier escritura", async (_path, attack) => {
    const response = await attack();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No autorizado." });
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.encryptVaultCredentials).not.toHaveBeenCalled();
    expect(mocks.encryptVaultText).not.toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();
    expect(mocks.testTenantConnection).not.toHaveBeenCalled();
    expect(mocks.unexpectedFrom).not.toHaveBeenCalled();
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });
});
