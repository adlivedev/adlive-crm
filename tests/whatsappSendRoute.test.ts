import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createAdminClient: vi.fn(),
  sendMetaText: vi.fn(),
  sendMetaTemplate: vi.fn(),
}));

vi.mock("@/shared/lib/serverAuth", () => ({
  requireUser: mocks.requireUser,
  authErrorStatus: (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    return code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500;
  },
}));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/metaWhatsAppClient", () => ({
  sendMetaText: mocks.sendMetaText,
  sendMetaTemplate: mocks.sendMetaTemplate,
}));

import { POST } from "@/app/api/v1/whatsapp/send/route";

const now = new Date("2026-11-18T12:00:00.000Z");
const conversationId = "11111111-1111-4111-8111-111111111111";

interface MockQuery {
  select: () => MockQuery;
  eq: () => MockQuery;
  single: () => Promise<{ data: unknown; error: null }>;
}

function queryReturning(data: unknown): MockQuery {
  const query: MockQuery = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data, error: null }),
  };
  return query;
}

function arrangeContact(contact: { opt_out_marketing: boolean }, lastInboundAt: string) {
  const tables: Record<string, unknown> = {
    conversations: { id: conversationId, tenant_id: "tenant-1", contact_id: "contact-1", last_inbound_at: lastInboundAt },
    tenant_members: { id: "member-1" },
    contacts: { id: "contact-1", phone_e164: "573201234567", ...contact },
  };
  mocks.requireUser.mockResolvedValue({
    supabase: { from: (table: string) => queryReturning(tables[table] ?? null) },
    user: { id: "user-1" },
  });
}

function request() {
  return new Request("http://localhost/api/v1/whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, body: "Mensaje de prueba", msg_type: "text" }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TC-009 / TC-012 — bloqueos del Route Handler de WhatsApp", () => {
  it("rechaza un contacto con opt-out antes de crear el cliente administrativo o llamar a Meta", async () => {
    arrangeContact({ opt_out_marketing: true }, now.toISOString());

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "El contacto pidió no recibir más mensajes. Respeta su opt-out." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.sendMetaText).not.toHaveBeenCalled();
    expect(mocks.sendMetaTemplate).not.toHaveBeenCalled();
  });

  it("rechaza texto en el límite exacto de 24 horas antes de crear el cliente administrativo o llamar a Meta", async () => {
    arrangeContact(
      { opt_out_marketing: false },
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "La ventana de 24 horas está cerrada. Usa una plantilla aprobada." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.sendMetaText).not.toHaveBeenCalled();
    expect(mocks.sendMetaTemplate).not.toHaveBeenCalled();
  });
});
