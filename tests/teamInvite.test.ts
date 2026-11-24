import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), createAdminClient: vi.fn(),
  inviteUserByEmail: vi.fn(), tenantMembersUpsert: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "super@adlive.test" } }, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.createAdminClient.mockReturnValue({
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
    from: (table: string) => {
      if (table === "tenants") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { slug: "cierto" }, error: null })) })) })) };
      }
      if (table === "tenant_members") return { upsert: mocks.tenantMembersUpsert };
      throw new Error(`Tabla no esperada: ${table}`);
    },
  });
});

describe("TC-TEAM-INVITE — QA-003: override auditado de superadmin y QA-002: errores reales", () => {
  it("el superadmin de plataforma (sin membresía) invita a un workspace cliente: 201 y membresía creada", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "uuid-invitado" } }, error: null });
    mocks.tenantMembersUpsert.mockResolvedValue({ error: null });

    const response = await inviteMember(json({ tenantId, email: "nuevo@cierto.test", role: "agent" }));

    expect(response.status).toBe(201);
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith("nuevo@cierto.test", { redirectTo: expect.stringContaining("/login?workspace=cierto") });
    expect(mocks.tenantMembersUpsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: tenantId,
      email: "nuevo@cierto.test",
      role: "agent",
      is_active: true,
    }), { onConflict: "tenant_id,email" });
  });

  it("si Supabase no puede invitar (correo inválido/registrado), responde 400 y NO crea membresía", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "Email address is invalid" } });

    const response = await inviteMember(json({ tenantId, email: "registrado@otro.test", role: "agent" }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("invitar");
    expect(mocks.tenantMembersUpsert).not.toHaveBeenCalled();
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
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("rechaza el payload cuando el workspace no existe", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
      from: () => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) }),
    });

    const response = await inviteMember(json({ tenantId: "99999999-9999-4999-8999-999999999999", email: "x@y.test", role: "agent" }));

    expect(response.status).toBe(400);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });
});
