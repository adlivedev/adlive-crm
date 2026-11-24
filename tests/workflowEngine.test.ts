import { describe, expect, it } from "vitest";

import {
  addWorkflowInitialNode,
  createWorkflow,
  type CrmState,
} from "@/shared/services/crmActions";
import type { CrmInitialData } from "@/shared/mocks/initialData";
import {
  buildRoundRobinTemplateCanvas,
  buildWelcomeTemplateCanvas,
  pickRoundRobinMember,
  seedTriggerCanvas,
  TRIGGER_NODE_LABELS,
  triggerFilterMatches,
  workflowPublishBlockReason,
} from "@/shared/lib/workflowEngine";
import type { TenantMember, WorkflowTriggerType } from "@/shared/types/database";

function emptyState(): CrmState {
  const data: CrmInitialData = {
    tenants: [], tenantMembers: [],
    contacts: [], customFieldDefinitions: [], customValues: [], pipelines: [], pipelineStages: [],
    opportunities: [], conversations: [], messages: [], contactNotes: [], contactTasks: [], contactActivities: [],
    whatsappTemplates: [], workflows: [], workflowEnrollments: [], aiBots: [], integrationsVault: [],
  };
  return { data, statsDelta: {} };
}

describe("TC-WF-TRIGGER — QA-001: siembra del nodo disparador al crear el workflow", () => {
  it.each(["manual_enrollment", "contact_created", "channel_message_received"] as WorkflowTriggerType[])(
    "el workflow nuevo nace con el nodo disparador «%s» sembrado",
    (triggerType) => {
      const state = createWorkflow(emptyState(), "t-1", { name: "Flujo de prueba", trigger_type: triggerType });
      const workflow = state.data.workflows[0]!;
      expect(workflow.canvas_definition.nodes).toHaveLength(1);
      const node = workflow.canvas_definition.nodes[0]!;
      expect(node.type).toBe("trigger");
      expect(node.label).toBe(TRIGGER_NODE_LABELS[triggerType]);
      expect(workflow.canvas_definition.edges).toHaveLength(0);
    },
  );

  it("seedTriggerCanvas genera un lienzo con el disparador en el origen", () => {
    const canvas = seedTriggerCanvas("channel_message_received", "n-trigger");
    expect(canvas.nodes[0]).toMatchObject({ id: "n-trigger", type: "trigger", label: "Mensaje recibido en WhatsApp", position: { x: 0, y: 0 } });
  });

  it("addWorkflowInitialNode crea el primer nodo sin exigir un nodo origen (compatibilidad con lienzos vacíos)", () => {
    const state = emptyState();
    state.data.workflows.push({
      id: "wf-vacio",
      tenant_id: "t-1",
      name: "Workflow heredado",
      description: null,
      status: "Draft",
      trigger_type: "manual_enrollment",
      allow_reenrollment: false,
      canvas_definition: { nodes: [], edges: [] },
      enrolled_count: 0,
      active_count: 0,
      updated_at: "2026-11-23T00:00:00.000Z",
      created_at: "2026-11-23T00:00:00.000Z",
    });
    const next = addWorkflowInitialNode(state, "wf-vacio", {
      label: TRIGGER_NODE_LABELS.manual_enrollment,
      config: { origen: "Inscripción manual desde Contactos" },
      type: "trigger",
    });
    const canvas = next.data.workflows[0]!.canvas_definition;
    expect(canvas.nodes).toHaveLength(1);
    expect(canvas.nodes[0]!.type).toBe("trigger");
    expect(canvas.nodes[0]!.label).toBe("Inscripción manual");
  });

  it("addWorkflowInitialNode no toca un lienzo que ya tiene nodos", () => {
    const seeded = createWorkflow(emptyState(), "t-1", { name: "Flujo", trigger_type: "contact_created" });
    const workflowId = seeded.data.workflows[0]!.id;
    const next = addWorkflowInitialNode(seeded, workflowId, { label: "Otro disparador", config: {} });
    expect(next.data.workflows[0]!.canvas_definition.nodes).toHaveLength(1);
  });
});

describe("TC-WF-PUBLISH — rechazo de publicación de workflow vacío o incompleto", () => {
  it("bloquea la publicación sin disparador y sin acciones", () => {
    expect(workflowPublishBlockReason({ canvas_definition: { nodes: [], edges: [] } })).toContain("disparador");
  });

  it("bloquea la publicación cuando solo hay disparador (falta al menos una acción)", () => {
    const state = createWorkflow(emptyState(), "t-1", { name: "Solo trigger", trigger_type: "contact_created" });
    const reason = workflowPublishBlockReason(state.data.workflows[0]!);
    expect(reason).toContain("acción");
  });

  it("permite publicar cuando hay al menos 1 disparador y 1 acción", () => {
    const state = createWorkflow(emptyState(), "t-1", { name: "Completo", trigger_type: "contact_created" });
    const workflowId = state.data.workflows[0]!.id;
    const withAction = addWorkflowInitialNode(state, workflowId, { label: "", config: {} }); // no-op: ya tiene nodo
    const workflow = withAction.data.workflows[0]!;
    workflow.canvas_definition.nodes.push({
      id: "n-accion", type: "action", label: "Marcar en seguimiento", config: {}, position: { x: 0, y: 150 },
    });
    expect(workflowPublishBlockReason(workflow)).toBeNull();
  });
});

describe("TC-WF-ROUNDROBIN — reparto equitativo entre 6 agentes simulados", () => {
  function agent(id: string, lastAssignedAt: string | null): TenantMember {
    return {
      id, tenant_id: "t-1", user_id: null, email: `${id}@adlive.test`, role: "agent", is_active: true,
      can_view_all_contacts: false, presence: "offline", last_assigned_at: lastAssignedAt, created_at: "2026-11-23T00:00:00.000Z",
    };
  }

  it("elige siempre al agente con last_assigned_at más antiguo (NULLS FIRST)", () => {
    const agents = [agent("m1", "2026-11-20T10:00:00.000Z"), agent("m2", null), agent("m3", "2026-11-23T09:00:00.000Z")];
    expect(pickRoundRobinMember(agents)!.id).toBe("m2");
    expect(pickRoundRobinMember([agent("m1", "2026-11-20T10:00:00.000Z"), agent("m3", "2026-11-23T09:00:00.000Z")])!.id).toBe("m1");
  });

  it("reparte 40 leads del día entre 6 agentes activos de forma equilibrada", () => {
    const agents = Array.from({ length: 6 }, (_, index) => agent(`agente-${index + 1}`, null));
    const counts = new Map<string, number>(agents.map((item) => [item.id, 0]));
    for (let lead = 0; lead < 40; lead += 1) {
      const pick = pickRoundRobinMember(agents);
      expect(pick).not.toBeNull();
      const assignedAt = new Date(Date.UTC(2026, 10, 23, 8, 0, 0) + lead * 60_000).toISOString();
      pick!.last_assigned_at = assignedAt;
      counts.set(pick!.id, (counts.get(pick!.id) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(40);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(6);
  });

  it("devuelve null cuando no hay agentes candidatos", () => {
    expect(pickRoundRobinMember([])).toBeNull();
  });
});

describe("TC-WF-FILTER — filtro opcional del disparador (campaña / landing / etiqueta)", () => {
  it("sin filtro inscribe cualquier evento", () => {
    expect(triggerFilterMatches({}, { utmCampaign: "cualquiera" })).toBe(true);
    expect(triggerFilterMatches({ filtro_tipo: "ninguno" }, {})).toBe(true);
  });

  it("filtra por campaña UTM (ej. «Plan 50GB Movistar»)", () => {
    const config = { filtro_tipo: "campania", filtro_valor: "Plan 50GB Movistar" };
    expect(triggerFilterMatches(config, { utmCampaign: "Plan 50GB Movistar - Noviembre" })).toBe(true);
    expect(triggerFilterMatches(config, { utmCampaign: "Otra campaña" })).toBe(false);
  });

  it("filtra por landing o URL y por etiqueta del contacto", () => {
    expect(triggerFilterMatches({ filtro_tipo: "landing", filtro_valor: "captacion-hero" }, { landingUrl: "https://x.com/l/cierto/captacion-hero" })).toBe(true);
    expect(triggerFilterMatches({ filtro_tipo: "etiqueta", filtro_valor: "lead-formulario" }, { tags: ["lead-formulario", "06112026"] })).toBe(true);
    expect(triggerFilterMatches({ filtro_tipo: "etiqueta", filtro_valor: "ausente" }, { tags: ["otra"] })).toBe(false);
  });
});

describe("TC-WF-TEMPLATES — plantillas recomendadas de 1 clic", () => {
  it("la plantilla de bienvenida pre-arma Trigger → Enviar WhatsApp → Mover a Interesado → Asignar Round Robin", () => {
    const canvas = buildWelcomeTemplateCanvas({
      triggerType: "contact_created",
      templateName: "bienvenida_lead",
      stageId: "stage-interesado",
      stageName: "Interesado",
    });
    const labels = canvas.nodes.map((node) => node.label);
    expect(canvas.nodes[0]!.type).toBe("trigger");
    expect(labels).toContain("Enviar WhatsApp");
    expect(labels).toContain("Mover a Interesado");
    expect(labels.some((label) => label.startsWith("Asignar a un miembro"))).toBe(true);
    expect(canvas.edges).toHaveLength(3);
    expect(canvas.edges.every((edge) => edge.label === null)).toBe(true);
  });

  it("la plantilla de reparto pre-arma Trigger → Marcar seguimiento → Asignar equitativamente", () => {
    const canvas = buildRoundRobinTemplateCanvas("channel_message_received");
    const labels = canvas.nodes.map((node) => node.label);
    expect(labels).toEqual(["Mensaje recibido en WhatsApp", "Marcar en seguimiento", "Asignar a un miembro (Round robin)"]);
    expect(canvas.edges).toHaveLength(2);
  });
});
