import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  emailSlaAlert: vi.fn(),
  sendDailySummary: vi.fn(),
  runSlaWorkflowsSweep: vi.fn(),
}));

vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/shared/services/conversationAlertService", () => ({
  emailSlaAlert: mocks.emailSlaAlert,
  sendDailySummary: mocks.sendDailySummary,
}));
vi.mock("@/shared/services/workflowExecutionService", () => ({
  executeWorkflowsForEvent: vi.fn(),
  executeWorkflowsForFirstInboundMessage: vi.fn(),
  runSlaWorkflowsSweep: mocks.runSlaWorkflowsSweep,
}));

import { GET, POST } from "@/app/api/v1/cron/process-jobs/route";
import { isCronAuthorized, partitionJobsByActiveTenants } from "@/shared/lib/cronSecurity";

const CIERTO = "tenant-cierto";
const EMPRESA_B = "tenant-empresab";
const SUSPENDIDA = "tenant-suspendida";

interface Call { op: string; table: string; patch?: Record<string, unknown>; row?: unknown }

function makeAdmin(tables: Record<string, Array<Record<string, unknown>>>, calls: Call[]) {
  return {
    from(table: string) {
      let rows: Array<Record<string, unknown>> = [...(tables[table] ?? [])];
      const api: Record<string, unknown> = {};
      Object.assign(api, {
        select: () => api,
        insert: (row: unknown) => {
          calls.push({ op: "insert", table, row });
          return { select: () => api, single: async () => ({ data: null, error: null }) };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: (_column: string, id: unknown) => {
            calls.push({ op: "update", table, patch: { ...patch, _id: id } });
            return Promise.resolve({ error: null });
          },
        }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        eq: (column: string, value: unknown) => {
          if (table === "tenants" && column === "status") rows = rows.filter((row) => row.status === value);
          if (table === "background_jobs" && (column === "status" || column === "tenant_id")) rows = rows.filter((row) => row[column] === value);
          return api;
        },
        lte: () => api,
        not: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (onFulfilled: (value: unknown) => unknown) => onFulfilled({ data: rows, error: null }),
      });
      return api;
    },
  };
}

function arrange() {
  const calls: Call[] = [];
  const tables: Record<string, Array<Record<string, unknown>>> = {
    tenants: [
      { id: CIERTO, status: "active" },
      { id: EMPRESA_B, status: "active" },
      { id: SUSPENDIDA, status: "suspended" },
    ],
    background_jobs: [
      { id: "job-bad", tenant_id: EMPRESA_B, job_type: "tipo_desconocido", payload: {}, attempts: 0, max_attempts: 3, status: "pending" },
      { id: "job-ok", tenant_id: CIERTO, job_type: "conversation_sla_alert", payload: { hours: 1 }, attempts: 0, max_attempts: 3, status: "pending" },
      { id: "job-suspended", tenant_id: SUSPENDIDA, job_type: "daily_summary", payload: {}, attempts: 0, max_attempts: 3, status: "pending" },
    ],
    conversations: [],
  };
  mocks.createAdminClient.mockReturnValue(makeAdmin(tables, calls));
  mocks.runSlaWorkflowsSweep.mockResolvedValue({ workflows: 0, enrolled: 0 });
  return calls;
}

function cronRequest(method: "GET" | "POST", token?: string) {
  return new Request("http://localhost/api/v1/cron/process-jobs", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("TC-CRON-AUTH — autorización con comparación en tiempo constante", () => {
  it("rechaza 401 sin cabecera Authorization", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    arrange();
    expect((await GET(cronRequest("GET"))).status).toBe(401);
  });

  it("rechaza 401 con token inválido (GET y POST)", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    arrange();
    expect((await GET(cronRequest("GET", "token-equivocado"))).status).toBe(401);
    expect((await POST(cronRequest("POST", "token-equivocado"))).status).toBe(401);
  });

  it("acepta el token exacto en GET y POST", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    arrange();
    const get = await GET(cronRequest("GET", "secreto-de-prueba"));
    const post = await POST(cronRequest("POST", "secreto-de-prueba"));
    expect(get.status).toBe(200);
    expect(post.status).toBe(200);
  });

  it("isCronAuthorized: sin secreto configurado todo se rechaza", () => {
    expect(isCronAuthorized("Bearer x", undefined)).toBe(false);
    expect(isCronAuthorized(null, "abc")).toBe(false);
    expect(isCronAuthorized("Bearer abc", "abc")).toBe(true);
    expect(isCronAuthorized("Basic abc", "abc")).toBe(false);
  });
});

describe("TC-CRON-ISOLATION — aislamiento multi-tenant del cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secreto-de-prueba";
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  it("solo procesa jobs de tenants activos; suspended queda intacto", async () => {
    const calls = arrange();
    const response = await GET(cronRequest("GET", "secreto-de-prueba"));
    expect(response.status).toBe(200);
    const body = await response.json() as { processed: number; failed: number; skipped: number };
    expect(body.processed).toBe(1); // solo el job de CIERTO
    expect(body.failed).toBe(1); // job de EmpresaB falla (tipo desconocido) y se reintenta
    expect(body.skipped).toBe(1); // job de la suspendida se omite

    const updates = calls.filter((call) => call.op === "update" && call.table === "background_jobs");
    const idOf = (call: Call) => (call.patch as { _id?: string })._id;
    // Job de CIERTO completado.
    expect(updates.some((call) => idOf(call) === "job-ok" && (call.patch as { status?: string }).status === "completed")).toBe(true);
    // Job de EmpresaB queda pending con attempts=1 (reintento, no detiene a CIERTO).
    expect(updates.some((call) => idOf(call) === "job-bad" && (call.patch as { status?: string }).status === "pending" && (call.patch as { attempts?: number }).attempts === 1)).toBe(true);
    // El job de la suspendida jamás se actualiza.
    expect(updates.some((call) => idOf(call) === "job-suspended")).toBe(false);
  });

  it("un fallo en EmpresaB no impide que CIERTO complete su ejecución", async () => {
    const calls = arrange();
    await GET(cronRequest("GET", "secreto-de-prueba"));
    const updates = calls.filter((call) => call.op === "update" && call.table === "background_jobs");
    const completed = updates.filter((call) => (call.patch as { status?: string }).status === "completed");
    const retried = updates.filter((call) => (call.patch as { status?: string }).status === "pending");
    expect(completed.length).toBe(1);
    expect(retried.length).toBe(1);
  });

  it("el barrido SLA recibe solo los tenants activos", async () => {
    arrange();
    await GET(cronRequest("GET", "secreto-de-prueba"));
    expect(mocks.runSlaWorkflowsSweep).toHaveBeenCalledWith(new Set([CIERTO, EMPRESA_B]));
  });
});

describe("TC-CRON-PARTITION — partición pura de jobs por tenant activo", () => {
  it("separa ejecutables de omitidos", () => {
    const active = new Set(["t-1"]);
    const { runnable, skipped } = partitionJobsByActiveTenants(active, [
      { id: "j1", tenant_id: "t-1" },
      { id: "j2", tenant_id: "t-2" },
      { id: "j3", tenant_id: "t-1" },
    ]);
    expect(runnable.map((job) => job.id)).toEqual(["j1", "j3"]);
    expect(skipped.map((job) => job.id)).toEqual(["j2"]);
  });
});
