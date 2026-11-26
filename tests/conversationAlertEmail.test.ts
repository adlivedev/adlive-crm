import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendWorkspaceEmail: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/mail/smtpMailer", () => ({ sendWorkspaceEmail: mocks.sendWorkspaceEmail }));

import { emailLeadAssigned, emailSlaAlert } from "@/shared/services/conversationAlertService";

const tenantId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";

/* Cadena PostgREST awaitable: cada método devuelve el mismo objeto thenable. */
function chainOf(data: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "in", "gte", "lte", "order", "limit", "maybeSingle"]) chain[method] = () => chain;
  chain.then = (callback: (value: unknown) => unknown) => Promise.resolve(callback({ data, error: null }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendWorkspaceEmail.mockResolvedValue(undefined);
  mocks.createAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === "tenant_members") return { select: () => chainOf([{ id: memberId, email: "agente@cierto.test" }]) };
      throw new Error(`Tabla no esperada: ${table}`);
    },
  });
});

describe("TC-ALERT-EMAIL — QA-NEW-009: URLs absolutas y escape HTML en correos", () => {
  it("emailLeadAssigned: enlace absoluto al CRM y nombre del contacto escapado", async () => {
    await emailLeadAssigned({
      tenantId, contactId: "c-1", memberId,
      contactName: "Juan <script>alert(1)</script> Pérez",
    });

    expect(mocks.sendWorkspaceEmail).toHaveBeenCalledTimes(1);
    const { html, to } = mocks.sendWorkspaceEmail.mock.calls[0]![0] as { html: string; to: string[] };
    expect(html).toContain('href="https://adlive-crm.vercel.app/contactos/c-1"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(to).toEqual(["agente@cierto.test"]);
  });

  it("emailSlaAlert: CTA absoluto con ?open= y nombre escapado", async () => {
    await emailSlaAlert({
      tenantId, memberId, conversationId: "conv-9", hours: 2,
      contactName: "María & Co <b>x</b>",
    });

    const { html } = mocks.sendWorkspaceEmail.mock.calls[0]![0] as { html: string };
    expect(html).toContain('href="https://adlive-crm.vercel.app/conversaciones?open=conv-9"');
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("María &amp; Co");
  });
});
