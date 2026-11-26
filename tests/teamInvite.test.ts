import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), createAdminClient: vi.fn(),
  generateLink: vi.fn(), deleteUser: vi.fn(), listUsers: vi.fn(), tenantMembersUpsert: vi.fn(),
  sendWorkspaceEmail: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));

import { POST as inviteMember } from "@/app/api/v1/team/invite/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function json(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function adminClientWithTenant(tenant: { slug: string; name: string } | null) {
  return {
    auth: { admin: { generateLink: mocks.generateLink, deleteUser: mocks.deleteUser, listUsers: mocks.listUsers } },
    from: (table: string) => {
      if (table === "tenants") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: tenant, error: null })) })) })) };
      }
      if (table === "tenant_members") return { upsert: mocks.tenantMembersUpsert };
      throw new Error(`Tabla no esperada: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "super@adlive.test" } }, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.createAdminClient.mockReturnValue(adminClientWithTenant({ slug: "cierto", name: "Cierto" }));
  mocks.generateLink.mockResolvedValue({ data: { user: { id: "uuid-invitado" }, properties: { action_link: "https://app.test/aceptar" } }, error: null });
  mocks.tenantMembersUpsert.mockResolvedValue({ error: null });
  mocks.sendWorkspaceEmail.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue({ error: null });
  /* Por defecto el correo NO existe previamente en auth.users (usuario nuevo). */
  mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
});

describe("TC-TEAM-INVITE — QA-003: override auditado de superadmin y QA-002: errores reales", () => {
  it("el superadmin de plataforma (sin membresía) invita a un workspace cliente: 201, membresía creada y correo enviado por SMTP de plataforma", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    const response = await inviteMember(json({ tenantId, email: "nuevo@cierto.test", role: "agent" }));

    expect(response.status).toBe(201);
    expect(mocks.generateLink).toHaveBeenCalledWith(expect.objectContaining({
      type: "invite",
      email: "nuevo@cierto.test",
    }));
    expect(mocks.tenantMembersUpsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: tenantId,
      email: "nuevo@cierto.test",
      role: "agent",
      is_active: true,
    }), { onConflict: "tenant_id,email" });
    expect(mocks.sendWorkspaceEmail).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      to: "nuevo@cierto.test",
    }));
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("si Supabase no puede generar el enlace, responde 400, NO crea membresía y NO envía correo", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.generateLink.mockResolvedValue({ data: { user: null, properties: null }, error: { message: "Email address is invalid" } });

    const response = await inviteMember(json({ tenantId, email: "registrado@otro.test", role: "agent" }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("invitaci");
    expect(mocks.tenantMembersUpsert).not.toHaveBeenCalled();
    expect(mocks.sendWorkspaceEmail).not.toHaveBeenCalled();
  });

  it("si el SMTP falla, revierte el usuario invitado y responde 502 sin crear membresía huérfana", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.tenantMembersUpsert.mockResolvedValue({ error: null });
    mocks.sendWorkspaceEmail.mockRejectedValue(new Error("SMTP down"));

    const response = await inviteMember(json({ tenantId, email: "agente@cierto.test", role: "agent" }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("SMTP");
    expect(mocks.deleteUser).toHaveBeenCalledWith("uuid-invitado");
  });

  it("un usuario sin membresía admin ni superadmin recibe 403 y nunca se crea cliente administrativo", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const memberQuery = {
      select: vi.fn(() => memberQuery),
      eq: vi.fn(() => memberQuery),
      in: vi.fn(() => memberQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
      from: vi.fn(() => memberQuery),
    });

    const response = await inviteMember(json({ tenantId, email: "intruso@x.test", role: "agent" }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("No autorizado.");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("rechaza el payload cuando el workspace no existe", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue(adminClientWithTenant(null));

    const response = await inviteMember(json({ tenantId: "99999999-9999-4999-8999-999999999999", email: "x@y.test", role: "agent" }));

    expect(response.status).toBe(400);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
});

describe("TC-TEAM-INVITE-ROLLBACK — bug crítico: jamás borrar una cuenta global preexistente", () => {
  const preexistingUserId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    /* El correo YA existe en auth.users (pertenece a otro workspace). */
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: preexistingUserId, email: "global@otro.test" }] },
      error: null,
    });
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: preexistingUserId }, properties: { action_link: "https://app.test/aceptar" } },
      error: null,
    });
  });

  it("si el correo ya existía y falla el upsert de membresía: 500 SIN deleteUser (la cuenta global sobrevive)", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.tenantMembersUpsert.mockResolvedValue({ error: { message: "conflicto" } });

    const response = await inviteMember(json({ tenantId, email: "global@otro.test", role: "agent" }));

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("si el correo ya existía y falla el SMTP: 502 SIN deleteUser (la cuenta global sobrevive)", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.tenantMembersUpsert.mockResolvedValue({ error: null });
    mocks.sendWorkspaceEmail.mockRejectedValue(new Error("SMTP down"));

    const response = await inviteMember(json({ tenantId, email: "global@otro.test", role: "agent" }));

    expect(response.status).toBe(502);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("si el correo NO existía y falla el upsert: 500 Y deleteUser solo de la cuenta recién creada", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: "uuid-recien-creado" }, properties: { action_link: "https://app.test/aceptar" } },
      error: null,
    });
    mocks.tenantMembersUpsert.mockResolvedValue({ error: { message: "conflicto" } });

    const response = await inviteMember(json({ tenantId, email: "fresco@cierto.test", role: "agent" }));

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUser).toHaveBeenCalledWith("uuid-recien-creado");
  });
});
