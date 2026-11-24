import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOT_OBJECTIVE_PRESETS,
  BOT_TONE_OPTIONS,
  compileBotPrompt,
} from "@/features/ai-bots/components/botsData";
import { maskToken } from "@/features/settings/components/settingsUtils";
import {
  createAiBot,
  type CrmState,
  deleteAiBot,
  updateAiBot,
} from "@/shared/services/crmActions";
import type { CrmInitialData } from "@/shared/mocks/initialData";

function emptyState(): CrmState {
  const data: CrmInitialData = {
    tenants: [], tenantMembers: [],
    contacts: [], customFieldDefinitions: [], customValues: [], pipelines: [], pipelineStages: [],
    opportunities: [], conversations: [], messages: [], contactNotes: [], contactTasks: [], contactActivities: [],
    whatsappTemplates: [], workflows: [], workflowEnrollments: [], aiBots: [], integrationsVault: [],
  };
  return { data, statsDelta: {} };
}

function stateWithBot(): CrmState {
  return createAiBot(emptyState(), "t-1", {
    name: "Asistente comercial",
    product_line: "Ventas",
    provider: "gemini",
    system_prompt: "Eres el asistente virtual de este negocio.",
  });
}

describe("Sprint 2 — formulario guiado del bot (compileBotPrompt)", () => {
  it("compila objetivo preset, conocimiento, handoff y tono en un solo prompt", () => {
    const prompt = compileBotPrompt({
      objectivePresetId: "calificar_portabilidad",
      customObjective: "",
      knowledge: "Plan Fibra 300 Mbps: $79.900/mes.",
      handoffRule: 'Cuando el cliente diga "quiero contratar".',
      toneId: "formal",
    });
    expect(prompt).toContain(BOT_OBJECTIVE_PRESETS[0]!.prompt.slice(0, 40));
    expect(prompt).toContain("Plan Fibra 300 Mbps: $79.900/mes.");
    expect(prompt).toContain('Cuando el cliente diga "quiero contratar"');
    expect(prompt).toContain(BOT_TONE_OPTIONS[1]!.prompt.slice(0, 30));
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("usa el objetivo personalizado cuando se elige «Personalizado»", () => {
    const prompt = compileBotPrompt({
      objectivePresetId: "personalizado",
      customObjective: "Agendar citas de instalación.",
      knowledge: "",
      handoffRule: "",
      toneId: "directo",
    });
    expect(prompt).toContain("Agendar citas de instalación.");
    expect(prompt).toContain(BOT_TONE_OPTIONS[2]!.prompt.slice(0, 20));
  });
});

describe("Sprint 2 — QA-004: acciones puras de bots", () => {
  it("deleteAiBot elimina el bot de la lista local sin mutar el estado original", () => {
    const state = stateWithBot();
    const botId = state.data.aiBots[0]!.id;
    const next = deleteAiBot(state, botId);
    expect(next.data.aiBots).toHaveLength(0);
    expect(state.data.aiBots).toHaveLength(1);
  });

  it("updateAiBot ajusta nombre e instrucciones sin recrear el bot", () => {
    const state = stateWithBot();
    const botId = state.data.aiBots[0]!.id;
    const next = updateAiBot(state, botId, { name: "Nuevo nombre", system_prompt: "Nuevas instrucciones." });
    expect(next.data.aiBots[0]).toMatchObject({ id: botId, name: "Nuevo nombre", system_prompt: "Nuevas instrucciones." });
    expect(state.data.aiBots[0]!.name).toBe("Asistente comercial");
  });
});

describe("Sprint 2 — QA-012: maskToken", () => {
  it("enmascara el token mostrando solo los últimos 4 caracteres", () => {
    expect(maskToken("abcdef1234567890")).toBe("••••••7890");
  });
  it("devuelve cadena vacía para token vacío y todo enmascarado si es corto", () => {
    expect(maskToken("")).toBe("");
    expect(maskToken("   ")).toBe("");
    expect(maskToken("abcd")).toBe("••••••");
  });
});

/* --------------------------------------------------------------------------
 * Ruta POST /api/v1/ai-bots/test — «Probar Bot en Vivo»
 * ------------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  requireGuard: vi.fn(),
  generateAnswer: vi.fn(),
}));
vi.mock("@/shared/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/shared/lib/serverAuth", () => ({
  requireTenantAdminOrPlatformSuperadmin: mocks.requireGuard,
  authErrorStatus: (error: unknown) => error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500,
}));
vi.mock("@/shared/services/aiBotService", () => ({
  generateBotAnswerForTest: mocks.generateAnswer,
  ProviderHttpError: class ProviderHttpError extends Error {
    readonly status: number;
    constructor(status: number) {
      super(`El proveedor de IA respondió con estado ${status}.`);
      this.name = "ProviderHttpError";
      this.status = status;
    }
  },
}));

import { POST } from "@/app/api/v1/ai-bots/test/route";

const tenantId = "11111111-1111-4111-8111-111111111111";
const botId = "22222222-2222-4222-8222-222222222222";

function botQuery(bot: Record<string, unknown> | null) {
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: bot, error: null })),
  });
  return query;
}

function requestWith(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/ai-bots/test", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("Sprint 2 — POST /api/v1/ai-bots/test (Probar Bot en Vivo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireGuard.mockResolvedValue({});
    mocks.generateAnswer.mockResolvedValue("¡Hola! El plan de 300 megas cuesta $79.900 al mes.");
    mocks.admin.mockReturnValue({ from: vi.fn(() => botQuery({ provider: "gemini", system_prompt: "Eres el asistente." })) });
  });

  it("owner/admin recibe la respuesta real del bot (200)", async () => {
    const response = await POST(requestWith({ tenantId, botId, testMessage: "¿Precio del plan?" }));
    const body = await response.json() as { reply?: string };
    expect(response.status).toBe(200);
    expect(body.reply).toContain("$79.900");
    expect(mocks.requireGuard).toHaveBeenCalledWith(tenantId);
    expect(mocks.generateAnswer).toHaveBeenCalledWith("gemini", tenantId, "Eres el asistente.", "¿Precio del plan?");
  });

  it("rechaza con 403 a un agente sin permisos de admin", async () => {
    mocks.requireGuard.mockRejectedValue(new Error("FORBIDDEN"));
    const response = await POST(requestWith({ tenantId, botId, testMessage: "hola" }));
    expect(response.status).toBe(403);
    expect(mocks.generateAnswer).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el bot no existe en el tenant", async () => {
    mocks.admin.mockReturnValue({ from: vi.fn(() => botQuery(null)) });
    const response = await POST(requestWith({ tenantId, botId, testMessage: "hola" }));
    expect(response.status).toBe(404);
    expect(mocks.generateAnswer).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el proveedor del bot no admite pruebas directas", async () => {
    mocks.admin.mockReturnValue({ from: vi.fn(() => botQuery({ provider: "integrated", system_prompt: "x" })) });
    const response = await POST(requestWith({ tenantId, botId, testMessage: "hola" }));
    expect(response.status).toBe(400);
    expect(mocks.generateAnswer).not.toHaveBeenCalled();
  });

  it("devuelve 500 con mensaje amigable si el proveedor falla", async () => {
    mocks.generateAnswer.mockRejectedValue(new Error("El proveedor del bot no tiene una API key configurada."));
    const response = await POST(requestWith({ tenantId, botId, testMessage: "hola" }));
    const body = await response.json() as { error?: string };
    expect(response.status).toBe(500);
    expect(body.error).toContain("No se pudo probar el bot");
  });

  it("valida el esquema del body (400 con datos inválidos)", async () => {
    const response = await POST(requestWith({ tenantId: "no-uuid", botId, testMessage: "hola" }));
    expect(response.status).toBe(400);
  });
});
