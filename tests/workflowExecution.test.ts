import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), sendMetaTemplate: vi.fn() }));

vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/lib/metaWhatsAppClient", () => ({ sendMetaTemplate: mocks.sendMetaTemplate }));

import { executeWorkflowsForEvent } from "@/shared/services/workflowExecutionService";
import type { Workflow } from "@/shared/types/database";

const tenantId = "11111111-1111-4111-8111-111111111111";
const contactId = "33333333-3333-4333-8333-333333333333";

interface FakeQuery {
  [key: string]: unknown;
  then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
}

interface RecordedCalls {
  inserts: Record<string, unknown[]>;
  updates: Record<string, unknown[]>;
}

function fakeAdmin(tables: Record<string, unknown[]>): { queryFor: (table: string) => FakeQuery; calls: RecordedCalls } {
  const calls: RecordedCalls = { inserts: {}, updates: {} };
  const queryFor = (table: string): FakeQuery => {
    let rows: unknown[] = [...(tables[table] ?? [])];
    let result: unknown = { data: rows, error: null, count: rows.length };
    const q: FakeQuery = {
      select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) result = { data: null, error: null, count: rows.length };
        else result = { data: rows, error: null, count: rows.length };
        return q;
      }),
      insert: vi.fn((value: unknown) => {
        const values = Array.isArray(value) ? value : [value];
        calls.inserts[table] = [...(calls.inserts[table] ?? []), ...values];
        rows = values.map((row, index) => ({ id: `new-${table}-${index}`, ...(row as Record<string, unknown>) }));
        result = { data: rows, error: null };
        return q;
      }),
      update: vi.fn((value: unknown) => {
        calls.updates[table] = [...(calls.updates[table] ?? []), value];
        result = { data: [], error: null };
        return q;
      }),
      upsert: vi.fn(() => q),
      eq: vi.fn(() => q),
      in: vi.fn(() => q),
      neq: vi.fn(() => q),
      order: vi.fn((column: string, { ascending = true, nullsFirst = false } = {}) => {
        const sorted = [...rows].sort((a, b) => {
          const av = (a as Record<string, unknown>)[column] ?? null;
          const bv = (b as Record<string, unknown>)[column] ?? null;
          if (av === null && bv === null) return 0;
          if (av === null) return nullsFirst ? -1 : 1;
          if (bv === null) return nullsFirst ? 1 : -1;
          const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
        rows = sorted;
        result = { data: rows, error: null };
        return q;
      }),
      limit: vi.fn((n: number) => {
        rows = rows.slice(0, n);
        result = { data: rows, error: null, count: rows.length };
        return q;
      }),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      single: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return q;
  };
  return { queryFor, calls };
}

function publishedWorkflow(canvas: Workflow["canvas_definition"], overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    tenant_id: tenantId,
    name: "Flujo de prueba",
    description: null,
    status: "Published",
    trigger_type: "contact_created",
    allow_reenrollment: false,
    canvas_definition: canvas,
    enrolled_count: 0,
    active_count: 0,
    updated_at: "2026-11-23T00:00:00.000Z",
    created_at: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

function roundRobinCanvas(): Workflow["canvas_definition"] {
  return {
    nodes: [
      { id: "n1", type: "trigger", label: "Contacto creado / Formulario Web", config: {}, position: { x: 0, y: 0 } },
      { id: "n2", type: "action", label: "Asignar a un miembro (Round robin)", config: { modo: "round_robin" }, position: { x: 0, y: 150 } },
    ],
    edges: [{ id: "e1", source_node_id: "n1", target_node_id: "n2", label: null }],
  };
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: contactId,
    tenant_id: tenantId,
    full_name: "Laura Prueba",
    phone_e164: "+573001112233",
    email: null,
    company_name: null,
    lead_source: "Formulario Web",
    tags: [] as string[],
    custom_fields: {},
    assigned_member_id: null,
    is_closed_client: false,
    is_starred: false,
    typification: null,
    opt_out_marketing: false,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    fbclid: null,
    landing_url: null,
    referrer_url: null,
    last_interaction_at: "2026-11-23T10:00:00.000Z",
    created_at: "2026-11-23T10:00:00.000Z",
    updated_at: "2026-11-23T10:00:00.000Z",
    ...overrides,
  };
}

const sixAgents = (assigned: Array<string | null>) => assigned.map((last, index) => ({
  id: `agente-${index + 1}`,
  tenant_id: tenantId,
  email: `agente${index + 1}@adlive.test`,
  role: "agent",
  is_active: true,
  last_assigned_at: last,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendMetaTemplate.mockResolvedValue("wamid.workflow.1");
});

describe("TC-WF-EXEC-RR — motor real: reparto Round Robin en servidor", () => {
  it("asigna el lead al agente activo con last_assigned_at más antiguo (NULLS FIRST) entre 6 agentes", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(roundRobinCanvas())],
      contacts: [contactRow()],
      tenant_members: sixAgents(["2026-11-22T08:00:00.000Z", "2026-11-23T07:00:00.000Z", null, "2026-11-21T08:00:00.000Z", "2026-11-23T08:00:00.000Z", "2026-11-20T08:00:00.000Z"]),
      workflow_enrollments: [],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    const result = await executeWorkflowsForEvent({ tenantId, contactId, event: "contact_created" });

    expect(result).toEqual({ matched: 1, enrolled: 1 });
    // El agente 3 (last_assigned_at NULL) recibe el lead primero.
    const memberUpdates = calls.updates.tenant_members ?? [];
    expect(memberUpdates[0]).toBeTruthy();
    const contactUpdates = calls.updates.contacts ?? [];
    expect(contactUpdates.some((update) => (update as Record<string, unknown>).assigned_member_id === "agente-3")).toBe(true);
    // Inscripción con logs del reparto.
    const enrollments = calls.inserts.workflow_enrollments ?? [];
    expect(enrollments).toHaveLength(1);
    const enrollment = enrollments[0] as { status: string; execution_logs: Array<{ node_label: string; outcome: string; detail: string }> };
    expect(enrollment.status).toBe("completed");
    const assignLog = enrollment.execution_logs.find((log) => log.node_label.startsWith("Asignar a un miembro"));
    expect(assignLog?.outcome).toBe("success");
    expect(assignLog?.detail).toContain("Reparto Round Robin → agente3@adlive.test");
  });

  it("respeta allow_reenrollment=false: no inscribe dos veces al mismo contacto", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(roundRobinCanvas())],
      contacts: [contactRow()],
      tenant_members: sixAgents([null, null, null, null, null, null]),
      workflow_enrollments: [{ id: "we-previa", workflow_id: "wf-1", contact_id: contactId }],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    const result = await executeWorkflowsForEvent({ tenantId, contactId, event: "contact_created" });

    expect(result.matched).toBe(1);
    expect(result.enrolled).toBe(0);
    expect(calls.inserts.workflow_enrollments ?? []).toHaveLength(0);
  });

  it("un workflow sin agentes activos falla la ejecución con log de error (no silencioso)", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(roundRobinCanvas())],
      contacts: [contactRow()],
      tenant_members: [],
      workflow_enrollments: [],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    await executeWorkflowsForEvent({ tenantId, contactId, event: "contact_created" });

    const enrollments = calls.inserts.workflow_enrollments ?? [];
    expect(enrollments).toHaveLength(1);
    const enrollment = enrollments[0] as { status: string; execution_logs: Array<{ outcome: string; detail: string }> };
    expect(enrollment.status).toBe("failed");
    expect(enrollment.execution_logs.some((log) => log.outcome === "error" && log.detail.includes("No hay agentes activos"))).toBe(true);
  });
});

describe("TC-WF-EXEC-WELCOME — bienvenida automática con plantilla aprobada de Meta", () => {
  function welcomeCanvas(): Workflow["canvas_definition"] {
    return {
      nodes: [
        { id: "n1", type: "trigger", label: "Contacto creado / Formulario Web", config: { filtro_tipo: "campania", filtro_valor: "Plan 50GB Movistar" }, position: { x: 0, y: 0 } },
        { id: "n2", type: "action", label: "Enviar WhatsApp", config: { template: "bienvenida_lead" }, position: { x: 0, y: 150 } },
      ],
      edges: [{ id: "e1", source_node_id: "n1", target_node_id: "n2", label: null }],
    };
  }

  it("ejecuta el envío real vía Meta (variables {{1}} = nombre) y registra inscripción y mensaje", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(welcomeCanvas())],
      contacts: [contactRow({ utm_campaign: "Plan 50GB Movistar - Noviembre" })],
      whatsapp_templates: [{ id: "wt-1", name: "bienvenida_lead", language: "es_CO", body_text: "Hola {{1}}, bienvenido. Tu plan te espera.", variables_count: 1, status: "APPROVED" }],
      conversations: [],
      messages: [],
      workflow_enrollments: [],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    const result = await executeWorkflowsForEvent({
      tenantId, contactId, event: "contact_created", utmCampaign: "Plan 50GB Movistar - Noviembre",
    });

    expect(result).toEqual({ matched: 1, enrolled: 1 });
    expect(mocks.sendMetaTemplate).toHaveBeenCalledWith(
      tenantId,
      "+573001112233",
      { name: "bienvenida_lead", language: "es_CO" },
      ["Laura"],
    );
    // Mensaje saliente registrado como queued y luego sent con wa_message_id.
    const insertedMessages = calls.inserts.messages ?? [];
    expect(insertedMessages[0]).toMatchObject({ direction: "outbound", msg_type: "template", template_name: "bienvenida_lead", status: "queued" });
    const messageUpdates = calls.updates.messages ?? [];
    expect(messageUpdates.some((update) => (update as Record<string, unknown>).status === "sent")).toBe(true);
    const enrollments = calls.inserts.workflow_enrollments ?? [];
    expect(enrollments).toHaveLength(1);
    const enrollment = enrollments[0] as { status: string; execution_logs: Array<{ node_label: string; outcome: string }> };
    expect(enrollment.status).toBe("completed");
    expect(enrollment.execution_logs.some((log) => log.node_label === "Enviar WhatsApp" && log.outcome === "success")).toBe(true);
  });

  it("respeta el filtro de campaña: un lead de otra campaña no se inscribe", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(welcomeCanvas())],
      contacts: [contactRow({ utm_campaign: "Otra campaña" })],
      workflow_enrollments: [],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    const result = await executeWorkflowsForEvent({
      tenantId, contactId, event: "contact_created", utmCampaign: "Otra campaña",
    });

    expect(result).toEqual({ matched: 0, enrolled: 0 });
    expect(mocks.sendMetaTemplate).not.toHaveBeenCalled();
    expect(calls.inserts.workflow_enrollments ?? []).toHaveLength(0);
  });

  it("respeta el opt-out del contacto: omite el envío y registra el log", async () => {
    const { queryFor, calls } = fakeAdmin({
      workflows: [publishedWorkflow(welcomeCanvas())],
      contacts: [contactRow({ opt_out_marketing: true, utm_campaign: "Plan 50GB Movistar" })],
      whatsapp_templates: [{ id: "wt-1", name: "bienvenida_lead", language: "es_CO", body_text: "Hola {{1}}", variables_count: 1, status: "APPROVED" }],
      conversations: [],
      messages: [],
      workflow_enrollments: [],
    });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => queryFor(table) });

    const result = await executeWorkflowsForEvent({
      tenantId, contactId, event: "contact_created", utmCampaign: "Plan 50GB Movistar",
    });

    expect(result.enrolled).toBe(1);
    expect(mocks.sendMetaTemplate).not.toHaveBeenCalled();
    const enrollment = (calls.inserts.workflow_enrollments ?? [])[0] as { status: string; execution_logs: Array<{ outcome: string; detail: string }> };
    expect(enrollment.execution_logs.some((log) => log.outcome === "skipped" && log.detail.includes("opt-out"))).toBe(true);
  });
});
