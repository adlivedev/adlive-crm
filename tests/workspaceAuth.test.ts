import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assignedMemberForView, canAgentAccessPath, contactMemberForView } from "@/shared/lib/auth/roleAccess";
import { ACTIVE_TENANT_COOKIE, evaluateWorkspaceAccess, EXCLUSIVE_WORKSPACE_ERROR, SUSPENDED_WORKSPACE_ERROR } from "@/shared/lib/auth/workspaceAccess";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  generateLink: vi.fn(),
  sendWorkspaceEmail: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));

import { POST as forgotPassword } from "@/app/api/v1/auth/forgot-password/route";
import { POST as workspaceLogin } from "@/app/api/v1/auth/workspace-login/route";

const cierto = {
  id: "11111111-1111-4111-8111-111111111111", name: "CIERTO", slug: "cierto", status: "active" as const,
  branding: {}, created_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z",
};
let tableRows: Record<string, unknown>;

function query(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function request(url: string, body: Record<string, unknown>) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:7100");
  tableRows = { platform_superadmins: null, tenants: cierto, tenant_members: { id: "member-1" } };
  mocks.from.mockImplementation((table: string) => query(tableRows[table] ?? null));
  mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@cierto.test" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({ auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut } });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from, auth: { admin: { generateLink: mocks.generateLink } } });
  mocks.generateLink.mockResolvedValue({
    data: { properties: { action_link: "https://supabase.test/auth/v1/verify?token=safe-token" }, user: { id: "user-1" } }, error: null,
  });
  mocks.sendWorkspaceEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Regla de aislamiento por workspace", () => {
  it("permite a superadmin entrar sin slug y también a un workspace suspendido", () => {
    expect(evaluateWorkspaceAccess({ isPlatformSuperadmin: true, workspaceSlug: null, workspace: { ...cierto, status: "suspended" }, hasActiveMembership: false }).allowed).toBe(true);
  });

  it("exige URL exclusiva y membresía exacta a usuarios de empresa", () => {
    expect(evaluateWorkspaceAccess({ isPlatformSuperadmin: false, workspaceSlug: null, workspace: cierto, hasActiveMembership: true })).toMatchObject({ allowed: false, message: EXCLUSIVE_WORKSPACE_ERROR });
    expect(evaluateWorkspaceAccess({ isPlatformSuperadmin: false, workspaceSlug: "otra", workspace: cierto, hasActiveMembership: false })).toMatchObject({ allowed: false, message: EXCLUSIVE_WORKSPACE_ERROR });
    expect(evaluateWorkspaceAccess({ isPlatformSuperadmin: false, workspaceSlug: "cierto", workspace: cierto, hasActiveMembership: true }).allowed).toBe(true);
  });

  it("distingue un workspace propio inhabilitado", () => {
    expect(evaluateWorkspaceAccess({ isPlatformSuperadmin: false, workspaceSlug: "cierto", workspace: { ...cierto, status: "suspended" }, hasActiveMembership: true })).toMatchObject({ allowed: false, message: SUSPENDED_WORKSPACE_ERROR });
  });
});

describe("Login validado en servidor", () => {
  it("crea la sesión para un miembro en su workspace y fija el tenant activo", async () => {
    const response = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@cierto.test", password: "secret-password", workspaceSlug: "cierto" }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(ACTIVE_TENANT_COOKIE)?.value).toBe(cierto.id);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("cierra la sesión de una empresa que intenta entrar sin slug", async () => {
    const response = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@cierto.test", password: "secret-password", workspaceSlug: null }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: EXCLUSIVE_WORKSPACE_ERROR });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("rechaza al usuario de CIERTO en /login?workspace=otra y cierra su sesión", async () => {
    tableRows.tenants = { ...cierto, id: "99999999-9999-4999-8999-999999999999", name: "OTRA", slug: "otra" };
    tableRows.tenant_members = null;
    const response = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@cierto.test", password: "secret-password", workspaceSlug: "otra" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: EXCLUSIVE_WORKSPACE_ERROR });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("permite al superadmin de ADlive entrar desde /login y desde cualquier workspace", async () => {
    tableRows.platform_superadmins = { user_id: "user-1" };
    tableRows.tenant_members = null;
    for (const workspaceSlug of [null, "otra"]) {
      tableRows.tenants = workspaceSlug
        ? { ...cierto, id: "99999999-9999-4999-8999-999999999999", name: "OTRA", slug: "otra" }
        : { ...cierto, name: "ADlive", slug: "adlive" };
      const response = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@adlive.test", password: "secret-password", workspaceSlug }));
      expect(response.status).toBe(200);
    }
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("bloquea una empresa suspendida pero permite inspección superadmin", async () => {
    tableRows.tenants = { ...cierto, status: "suspended" };
    const denied = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@cierto.test", password: "secret-password", workspaceSlug: "cierto" }));
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: SUSPENDED_WORKSPACE_ERROR });

    tableRows.platform_superadmins = { user_id: "user-1" };
    tableRows.tenant_members = null;
    const allowed = await workspaceLogin(request("http://localhost/api/v1/auth/workspace-login", { email: "owner@cierto.test", password: "secret-password", workspaceSlug: "cierto" }));
    expect(allowed.status).toBe(200);
  });
});

describe("Recuperación de contraseña sin enumeración", () => {
  it("genera enlace con redirect aislado y lo envía con la marca del workspace", async () => {
    const response = await forgotPassword(request("http://localhost/api/v1/auth/forgot-password", { email: "owner@cierto.test", workspaceSlug: "cierto" }));
    expect(response.status).toBe(200);
    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "recovery", email: "owner@cierto.test",
      options: { redirectTo: "http://localhost:7100/restablecer-contrasena?workspace=cierto" },
    });
    expect(mocks.sendWorkspaceEmail).toHaveBeenCalledWith(expect.objectContaining({ tenantId: cierto.id, to: "owner@cierto.test" }));
  });

  it("usa la misma respuesta para un workspace ajeno y no envía correo", async () => {
    tableRows.tenant_members = null;
    const response = await forgotPassword(request("http://localhost/api/v1/auth/forgot-password", { email: "owner@cierto.test", workspaceSlug: "cierto" }));
    const payload = await response.json() as { ok?: boolean; message?: string };
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain("Si el correo está registrado");
    expect(JSON.stringify(payload)).not.toContain("owner@cierto.test");
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();
  });

  it("no distingue correos inexistentes ni fallos de SMTP", async () => {
    mocks.generateLink.mockResolvedValue({ data: { properties: null, user: null }, error: { message: "User not found" } });
    const missing = await forgotPassword(request("http://localhost/api/v1/auth/forgot-password", { email: "missing@cierto.test", workspaceSlug: "cierto" }));
    expect(missing.status).toBe(200);
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();

    mocks.generateLink.mockResolvedValue({ data: { properties: { action_link: "https://supabase.test/recovery" }, user: { id: "user-1" } }, error: null });
    mocks.sendWorkspaceEmail.mockRejectedValue(new Error("SMTP unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const smtpFailure = await forgotPassword(request("http://localhost/api/v1/auth/forgot-password", { email: "owner@cierto.test", workspaceSlug: "cierto" }));
    expect(smtpFailure.status).toBe(200);
    expect(await smtpFailure.json()).toEqual(await missing.json());
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe("Rutas y filtros del rol agente", () => {
  it("permite solo los cinco módulos y detalles de contacto", () => {
    for (const allowed of ["/dashboard", "/contactos", "/contactos/contact-1", "/conversaciones", "/oportunidades", "/plantillas"]) {
      expect(canAgentAccessPath(allowed)).toBe(true);
    }
    for (const denied of ["/automatizaciones", "/integraciones", "/bots-ia", "/equipo", "/atribucion", "/ajustes", "/superadmin"]) {
      expect(canAgentAccessPath(denied)).toBe(false);
    }
  });

  it("mantiene chats y oportunidades propios aunque pueda ver todos los contactos", () => {
    expect(contactMemberForView("agent", "agent-1", true, null)).toBeNull();
    expect(assignedMemberForView("agent", "agent-1", null)).toBe("agent-1");
    expect(contactMemberForView("agent", "agent-1", false, null)).toBe("agent-1");
  });

  it("la vista como miembro filtra las cuatro áreas por ese miembro", () => {
    expect(contactMemberForView("owner", "owner-1", true, "agent-2")).toBe("agent-2");
    expect(assignedMemberForView("owner", "owner-1", "agent-2")).toBe("agent-2");
    expect(assignedMemberForView(null, null, "agent-3")).toBe("agent-3");
  });
});

describe("Lectura superadmin sin privilegios de escritura nuevos", () => {
  it("la migración crea únicamente políticas SELECT", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261120000200_workspace_auth_role_read.sql"), "utf8");
    expect(sql).toContain("FOR SELECT TO authenticated USING (public.is_platform_superadmin())");
    expect(sql).not.toContain("FOR ALL TO authenticated");
  });
});
