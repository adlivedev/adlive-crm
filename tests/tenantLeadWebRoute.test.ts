import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn() }));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));

import { OPTIONS, POST } from "@/app/api/v1/[tenantId]/webhooks/lead-web/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const token = "1234567890abcdef1234567890abcdef";
const context = { params: Promise.resolve({ tenantId }) };
const payload = {
  token, first_name: "Ana", last_name: "Pérez", phone: "+57 300 111 2233", email: "ana@example.com",
  custom_fields: { operador_actual: "Claro" }, utm_source: "facebook", utm_campaign: "captacion_noviembre",
};

function request(body: unknown = payload) {
  return new Request(`https://crm.test/api/v1/${tenantId}/webhooks/lead-web`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://cliente.example" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [{ out_contact_id: "22222222-2222-4222-8222-222222222222", out_assigned_member_id: null, out_opportunity_id: "33333333-3333-4333-8333-333333333333" }], error: null });
});

describe("Webhook de leads aislado por tenant", () => {
  it("normaliza el teléfono, prioriza UTM y devuelve la oportunidad", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("ingest_tenant_web_lead", expect.objectContaining({
      p_tenant_id: tenantId, p_public_webhook_token: token, p_first_name: "Ana", p_last_name: "Pérez",
      p_phone_e164: "+573001112233", p_custom_fields: { operador_actual: "Claro" }, p_lead_source: "facebook",
    }));
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, out_opportunity_id: "33333333-3333-4333-8333-333333333333" }));
  });

  it("rechaza un token incorrecto sin filtrar detalles", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "invalid_tenant_webhook_token" } });
    const response = await POST(request(), context);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Token no válido." });
  });

  it("rechaza payload inválido antes de abrir la base de datos", async () => {
    const response = await POST(request({ ...payload, first_name: "", custom_fields: { ciudad: 123 } }), context);
    expect(response.status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("acepta preflight CORS limitado a POST y OPTIONS", () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });
});
