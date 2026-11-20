import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
  serverRpc: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  generateLink: vi.fn(),
  deleteUser: vi.fn(),
  updateUserById: vi.fn(),
  provisionTenant: vi.fn(),
  sendWorkspaceEmail: vi.fn(),
  memberUpdates: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));

import { PATCH as patchTenant, POST as postTenant } from "@/app/api/v1/superadmin/tenants/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const existingUser = { id: "u-existing", email: "owner@test.com" };
const oldOwner = { id: "m-owner", user_id: "u-old", email: "old@test.com" };
const branding = {
  brand_name: "Empresa", logo_url: null, logo_dark_url: null,
  primary_color: "#5B00FF", primary_hover: "#4400CC", accent_color: "#29C5F6",
  sidebar_bg: "#0A0A12", canvas_bg: "#F6F7FB", ink_color: "#18181B",
};

function json(method: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/superadmin/tenants`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function memberChain() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => ({ data: oldOwner, error: null }));
  chain.update = vi.fn((values: Record<string, unknown>) => {
    mocks.memberUpdates(values);
    return { eq: vi.fn(async () => ({ error: null })) };
  });
  return chain;
}

function tenantsChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: { slug: "cierto", name: "CIERTO" }, error: null }));
  return chain;
}

function adminClient() {
  return {
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        createUser: mocks.createUser,
        generateLink: mocks.generateLink,
        deleteUser: mocks.deleteUser,
        updateUserById: mocks.updateUserById,
      },
    },
    rpc: mocks.provisionTenant,
    from: (table: string) => (table === "tenant_members" ? memberChain() : tenantsChain()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u-superadmin", email: "desarrollo@adlive.com.co" } }, error: null });
  mocks.serverRpc.mockResolvedValue({ data: true, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.serverRpc });
  mocks.createAdminClient.mockImplementation(() => adminClient());
  mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mocks.createUser.mockResolvedValue({ data: { user: { id: "u-new" } }, error: null });
  mocks.generateLink.mockResolvedValue({ data: { properties: { action_link: "https://supabase.test/invite" } }, error: null });
  mocks.provisionTenant.mockResolvedValue({ data: tenantId, error: null });
  mocks.sendWorkspaceEmail.mockResolvedValue(undefined);
});

describe("POST /api/v1/superadmin/tenants — propiedad de cuentas", () => {
  it("reutiliza la cuenta existente aunque pidan contraseña temporal, sin crear ni tocar contraseñas", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [existingUser] }, error: null });

    const response = await postTenant(json("POST", {
      name: "Empresa Reusada", slug: "empresa-reusada", adminEmail: "OWNER@test.com",
      temporaryPassword: "Temporal-123456", branding,
    }));
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(result.reusedAccount).toBe(true);
    expect(result.access).toBe("email_invitation");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.provisionTenant).toHaveBeenCalledWith("provision_tenant", expect.objectContaining({ p_admin_user_id: "u-existing" }));
    /* La invitación magiclink sí se envía para cuentas reutilizadas. */
    expect(mocks.generateLink).toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).toHaveBeenCalled();
  });

  it("crea una cuenta nueva con contraseña temporal y no envía correo", async () => {
    const response = await postTenant(json("POST", {
      name: "Empresa Nueva", slug: "empresa-nueva", adminEmail: "nuevo@test.com",
      temporaryPassword: "Temporal-123456", branding,
    }));
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(result.reusedAccount).toBe(false);
    expect(result.access).toBe("temporary_password");
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();
  });

  it("si el aprovisionamiento falla, borra únicamente la cuenta creada en la petición", async () => {
    mocks.provisionTenant.mockResolvedValue({ data: null, error: { message: "slug duplicado" } });

    const response = await postTenant(json("POST", { name: "Empresa Nueva", slug: "duplicada", adminEmail: "nuevo@test.com", branding }));

    expect(response.status).toBe(400);
    expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUser).toHaveBeenCalledWith("u-new");
  });

  it("si la cuenta ya existía y el aprovisionamiento falla, no se borra ninguna cuenta", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [existingUser] }, error: null });
    mocks.provisionTenant.mockResolvedValue({ data: null, error: { message: "slug duplicado" } });

    const response = await postTenant(json("POST", { name: "Empresa", slug: "duplicada", adminEmail: "owner@test.com", branding }));

    expect(response.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/superadmin/tenants — cambio de propietario", () => {
  it("reasigna a una cuenta existente sin renombrar la cuenta anterior", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "u-target", email: "Target@test.com" }] }, error: null });

    const response = await patchTenant(json("PATCH", { tenantId, adminEmail: "target@test.com" }));
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    /* La regresión que renombraba la cuenta global queda prohibida. */
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.memberUpdates).toHaveBeenCalledWith({ user_id: "u-target", email: "target@test.com" });
    /* Cuenta existente: no se envía invitación. */
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("crea una cuenta nueva para el propietario y le envía la invitación", async () => {
    const response = await patchTenant(json("PATCH", { tenantId, adminEmail: "nuevo-dueno@test.com" }));
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.memberUpdates).toHaveBeenCalledWith({ user_id: "u-new", email: "nuevo-dueno@test.com" });
    expect(mocks.generateLink).toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("si falla el envío de la invitación, revierte la fila y borra solo la cuenta creada", async () => {
    mocks.sendWorkspaceEmail.mockRejectedValue(new Error("SMTP caído"));

    const response = await patchTenant(json("PATCH", { tenantId, adminEmail: "nuevo-dueno@test.com" }));
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(result.ok).toBeUndefined();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.memberUpdates).toHaveBeenNthCalledWith(1, { user_id: "u-new", email: "nuevo-dueno@test.com" });
    expect(mocks.memberUpdates).toHaveBeenNthCalledWith(2, { user_id: "u-old", email: "old@test.com" });
    expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUser).toHaveBeenCalledWith("u-new");
  });
});
