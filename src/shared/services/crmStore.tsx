"use client";

/**
 * CAPA ADAPTADORA — Store reactivo del CRM (Etapa A, Mock en memoria).
 *
 * ÚNICA puerta de datos de la aplicación: los componentes leen y mutan
 * colecciones exclusivamente mediante `useCrm()`. En la Etapa B (Supabase
 * vía MCP) se reemplaza el interior de este archivo sin tocar la UI.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { initialData, mockTenantStats, type CrmInitialData, type TenantStatsBase } from "@/shared/mocks/initialData";
import { subscribeToInboxRealtime } from "@/shared/services/inboxRealtimeService";
import type {
  Contact,
  Conversation,
  Message,
  Opportunity,
  Pipeline,
  PipelineStage,
  Tenant,
  TenantMember,
  WorkflowEnrollment,
} from "@/shared/types/database";
import {
  EMPTY_STATS_DELTA,
  addContactActivity,
  addContactNote,
  addContactTask,
  addCustomField,
  addCustomValue,
  addWorkflowActionNode,
  assignConversation,
  createAiBot,
  createContact,
  createConversation,
  createOpportunity,
  createWhatsappTemplate,
  createWorkflow,
  deleteContact,
  deleteConversation,
  deleteCustomField,
  deleteCustomValue,
  deleteMember,
  deleteOpportunity,
  deleteWhatsappTemplate,
  deleteWorkflow,
  enrollContactInWorkflow,
  inviteMember,
  moveOpportunityToStage,
  nowIso,
  newId,
  receiveInboundMessage,
  sendMessage,
  setContactTypification,
  setIntegrationConnected,
  toggleAiBot,
  toggleContactStar,
  toggleContactTask,
  toggleWorkflowStatus,
  updateContact,
  updateMember,
  updateWorkflow,
  updateWorkflowNodeConfig,
  type AddWorkflowActionNodeInput,
  type CrmState,
  type CreateContactInput,
  type SendMessageInput,
  type SimulatedReply,
  type UpdateWorkflowInput,
} from "./crmActions";

/* ============================================================================
 * SESIÓN Y AUTENTICACIÓN (mock tipado, sin credenciales reales)
 * ========================================================================== */

export interface CrmSession {
  email: string;
  tenantId: string;
}

const SESSION_STORAGE_KEY = "adlive-crm-session";

export interface UserAccount {
  tenant: Tenant;
  memberId: string;
  role: TenantMember["role"];
}

export interface DashboardStats {
  totalContacts: number;
  openOpportunities: number;
  totalRevenue: number;
  unanswered: number;
}

export interface MonthlyPerformancePoint {
  monthKey: string;
  ganadas: number;
  perdidas: number;
}

export interface PipelineStageSummary {
  stage: PipelineStage;
  count: number;
  totalValue: number;
}

interface CrmContextValue {
  isHydrated: boolean;
  session: CrmSession | null;
  activeTenant: Tenant | null;
  activeMember: TenantMember | null;
  userAccounts: UserAccount[];
  /** Colecciones ya filtradas por la cuenta activa. */
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  opportunities: Opportunity[];
  pipelines: Pipeline[];
  pipelineStages: PipelineStage[];
  members: TenantMember[];
  templates: CrmInitialData["whatsappTemplates"];
  workflows: CrmInitialData["workflows"];
  workflowEnrollments: WorkflowEnrollment[];
  aiBots: CrmInitialData["aiBots"];
  integrations: CrmInitialData["integrationsVault"];
  customFields: CrmInitialData["customFieldDefinitions"];
  customValues: CrmInitialData["customValues"];
  notes: CrmInitialData["contactNotes"];
  tasks: CrmInitialData["contactTasks"];
  activities: CrmInitialData["contactActivities"];
  /** KPIs ejecutivos = línea base del mock + deltas de operaciones en vivo. */
  dashboardStats: DashboardStats;
  monthlyPerformance: MonthlyPerformancePoint[];
  pipelineSummary: PipelineStageSummary[];
  /* Autenticación y multi-tenancy */
  login: (email: string, password: string) => boolean;
  register: (agencyName: string, email: string, password: string) => boolean;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  /* CRUD en memoria */
  createContact: (input: CreateContactInput) => void;
  updateContact: (contactId: string, patch: Parameters<typeof updateContact>[2]) => void;
  deleteContact: (contactId: string) => void;
  toggleContactStar: (contactId: string) => void;
  setContactTypification: (contactId: string, typification: string | null) => void;
  createOpportunity: (input: Parameters<typeof createOpportunity>[2]) => void;
  moveOpportunityToStage: (opportunityId: string, targetStageId: string) => void;
  deleteOpportunity: (opportunityId: string) => void;
  sendMessage: (conversationId: string, input: SendMessageInput) => void;
  receiveInboundMessage: (conversationId: string, body: string, msgType?: Message["msg_type"]) => void;
  assignConversation: (conversationId: string, memberId: string | null) => void;
  deleteConversation: (conversationId: string) => void;
  addContactNote: (contactId: string, content: string) => void;
  addContactTask: (contactId: string, title: string, dueAt: string | null) => void;
  toggleContactTask: (taskId: string) => void;
  /** Devuelve el id de la conversación del contacto, creándola si no existe. */
  ensureConversation: (contactId: string) => string;
  addContactActivity: (contactId: string, activityType: string, description: string, metadata?: Record<string, string>) => void;
  createWhatsappTemplate: (input: Parameters<typeof createWhatsappTemplate>[2]) => void;
  deleteWhatsappTemplate: (templateId: string) => void;
  createWorkflow: (input: Parameters<typeof createWorkflow>[2]) => void;
  toggleWorkflowStatus: (workflowId: string) => void;
  deleteWorkflow: (workflowId: string) => void;
  updateWorkflow: (workflowId: string, input: UpdateWorkflowInput) => void;
  updateWorkflowNodeConfig: (workflowId: string, nodeId: string, config: Record<string, string>) => void;
  addWorkflowActionNode: (workflowId: string, sourceNodeId: string, input: AddWorkflowActionNodeInput) => void;
  /** Inscribe un contacto y ejecuta el flujo paso a paso (simulación del servidor). */
  enrollContactInWorkflow: (workflowId: string, contactId: string, simulatedReply: SimulatedReply | null) => void;
  inviteMember: (email: string, role: TenantMember["role"]) => void;
  updateMember: (memberId: string, patch: Parameters<typeof updateMember>[2]) => void;
  deleteMember: (memberId: string) => void;
  createAiBot: (input: Parameters<typeof createAiBot>[2]) => void;
  toggleAiBot: (botId: string) => void;
  setIntegrationConnected: (provider: Parameters<typeof setIntegrationConnected>[2], connected: boolean) => void;
  addCustomField: (input: Parameters<typeof addCustomField>[2]) => void;
  deleteCustomField: (fieldId: string) => void;
  addCustomValue: (valueKey: string, valueContent: string) => void;
  deleteCustomValue: (valueId: string) => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);

const ZERO_BASE: TenantStatsBase = {
  total_contacts: 0,
  open_opportunities: 0,
  total_revenue: 0,
  unanswered: 0,
  stage_counts: {},
  monthly: {},
};

function cloneInitialData(): CrmInitialData {
  return structuredClone(initialData);
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmState>(() => ({ data: cloneInitialData(), statsDelta: {} }));
  const [session, setSession] = useState<CrmSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  /* Restaurar sesión mock desde sessionStorage (evita rebotes en recargas). */
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CrmSession;
        if (parsed.email && parsed.tenantId) setSession(parsed);
      }
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setIsHydrated(true);
  }, []);

  const persistSession = useCallback((next: CrmSession | null) => {
    setSession(next);
    try {
      if (next) window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* sessionStorage no disponible: la sesión vive solo en memoria. */
    }
  }, []);

  const activeTenantId = session?.tenantId ?? null;

  /* Supabase Realtime queda aislado en el adaptador: la UI conserva su API y diseño. */
  useEffect(() => {
    if (!activeTenantId) return;

    function upsertRow<T extends { id: string }>(rows: T[], row: T): T[] {
      const index = rows.findIndex((current) => current.id === row.id);
      if (index < 0) return [row, ...rows];
      const next = rows.slice();
      next[index] = row;
      return next;
    }

    const unsubscribe = subscribeToInboxRealtime(activeTenantId, {
      onContact: (contact) => setState((prev) => ({
        ...prev,
        data: { ...prev.data, contacts: upsertRow(prev.data.contacts, contact) },
      })),
      onConversation: (conversation) => setState((prev) => ({
        ...prev,
        data: { ...prev.data, conversations: upsertRow(prev.data.conversations, conversation) },
      })),
      onMessage: (message) => setState((prev) => {
        if (prev.data.messages.some((current) => current.id === message.id)) return prev;
        return { ...prev, data: { ...prev.data, messages: [...prev.data.messages, message] } };
      }),
    });
    return () => unsubscribe?.();
  }, [activeTenantId]);

  const userAccounts = useMemo<UserAccount[]>(() => {
    if (!session) return [];
    return state.data.tenants
      .map((tenant) => {
        const member = state.data.tenantMembers.find((m) => m.tenant_id === tenant.id && m.email === session.email);
        return member ? { tenant, memberId: member.id, role: member.role } : null;
      })
      .filter((account): account is UserAccount => account !== null);
  }, [state.data.tenants, state.data.tenantMembers, session]);

  const activeTenant = useMemo(
    () => state.data.tenants.find((t) => t.id === activeTenantId) ?? null,
    [state.data.tenants, activeTenantId],
  );

  const activeMember = useMemo(
    () =>
      session && activeTenantId
        ? state.data.tenantMembers.find((m) => m.tenant_id === activeTenantId && m.email === session.email) ?? null
        : null,
    [state.data.tenantMembers, activeTenantId, session],
  );

  /* ---- Colecciones filtradas por cuenta activa ---- */
  const byTenant = useCallback(
    <T extends { tenant_id: string }>(rows: T[]): T[] =>
      activeTenantId ? rows.filter((row) => row.tenant_id === activeTenantId) : [],
    [activeTenantId],
  );

  const contacts = useMemo(() => byTenant(state.data.contacts), [byTenant, state.data.contacts]);
  const opportunities = useMemo(() => byTenant(state.data.opportunities), [byTenant, state.data.opportunities]);
  const pipelines = useMemo(() => byTenant(state.data.pipelines), [byTenant, state.data.pipelines]);
  const conversations = useMemo(() => byTenant(state.data.conversations), [byTenant, state.data.conversations]);
  const members = useMemo(() => byTenant(state.data.tenantMembers), [byTenant, state.data.tenantMembers]);
  const pipelineStages = useMemo(
    () => (activeTenantId ? state.data.pipelineStages.filter((s) => s.tenant_id === activeTenantId).sort((a, b) => a.position - b.position) : []),
    [state.data.pipelineStages, activeTenantId],
  );
  const messages = useMemo(() => byTenant(state.data.messages), [byTenant, state.data.messages]);
  const templates = useMemo(() => byTenant(state.data.whatsappTemplates), [byTenant, state.data.whatsappTemplates]);
  const workflows = useMemo(() => byTenant(state.data.workflows), [byTenant, state.data.workflows]);
  const workflowEnrollments = useMemo(() => byTenant(state.data.workflowEnrollments), [byTenant, state.data.workflowEnrollments]);
  const aiBots = useMemo(() => byTenant(state.data.aiBots), [byTenant, state.data.aiBots]);
  const integrations = useMemo(() => byTenant(state.data.integrationsVault), [byTenant, state.data.integrationsVault]);
  const customFields = useMemo(() => byTenant(state.data.customFieldDefinitions), [byTenant, state.data.customFieldDefinitions]);
  const customValues = useMemo(() => byTenant(state.data.customValues), [byTenant, state.data.customValues]);
  const notes = useMemo(() => byTenant(state.data.contactNotes), [byTenant, state.data.contactNotes]);
  const tasks = useMemo(() => byTenant(state.data.contactTasks), [byTenant, state.data.contactTasks]);
  const activities = useMemo(() => byTenant(state.data.contactActivities), [byTenant, state.data.contactActivities]);

  /* ---- KPIs: línea base del mock + deltas en vivo ---- */
  const dashboardStats = useMemo<DashboardStats>(() => {
    if (!activeTenantId) return { totalContacts: 0, openOpportunities: 0, totalRevenue: 0, unanswered: 0 };
    const base = mockTenantStats[activeTenantId] ?? ZERO_BASE;
    const delta = state.statsDelta[activeTenantId] ?? EMPTY_STATS_DELTA;
    return {
      totalContacts: Math.max(0, base.total_contacts + delta.totalContacts),
      openOpportunities: Math.max(0, base.open_opportunities + delta.openOpportunities),
      totalRevenue: Math.max(0, base.total_revenue + delta.revenue),
      unanswered: Math.max(0, base.unanswered + delta.unanswered),
    };
  }, [activeTenantId, state.statsDelta]);

  const monthlyPerformance = useMemo<MonthlyPerformancePoint[]>(() => {
    if (!activeTenantId) return [];
    const base = mockTenantStats[activeTenantId] ?? ZERO_BASE;
    const delta = state.statsDelta[activeTenantId] ?? EMPTY_STATS_DELTA;
    const keys = [...new Set([...Object.keys(base.monthly), ...Object.keys(delta.monthly)])].sort();
    return keys.slice(-6).map((monthKey) => ({
      monthKey,
      ganadas: (base.monthly[monthKey]?.ganadas ?? 0) + (delta.monthly[monthKey]?.ganadas ?? 0),
      perdidas: (base.monthly[monthKey]?.perdidas ?? 0) + (delta.monthly[monthKey]?.perdidas ?? 0),
    }));
  }, [activeTenantId, state.statsDelta]);

  const pipelineSummary = useMemo<PipelineStageSummary[]>(() => {
    if (!activeTenantId) return [];
    const base = mockTenantStats[activeTenantId] ?? ZERO_BASE;
    const delta = state.statsDelta[activeTenantId] ?? EMPTY_STATS_DELTA;
    return pipelineStages
      .filter((stage) => stage.stage_category === "open")
      .map((stage) => {
        const liveValue = opportunities
          .filter((o) => o.stage_id === stage.id && o.status === "open")
          .reduce((sum, o) => sum + o.monetary_value, 0);
        return {
          stage,
          count: Math.max(0, (base.stage_counts[stage.id] ?? 0) + (delta.stageCounts[stage.id] ?? 0)),
          totalValue: liveValue,
        };
      });
  }, [activeTenantId, pipelineStages, opportunities, state.statsDelta]);

  /* ---- Autenticación mock ---- */
  const login = useCallback(
    (email: string, _password: string): boolean => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes("@")) return false;
      const membership = state.data.tenantMembers.find((m) => m.email === normalizedEmail)
        ?? state.data.tenantMembers.find((m) => m.role === "admin");
      if (!membership) return false;
      persistSession({ email: membership.email, tenantId: membership.tenant_id });
      return true;
    },
    [state.data.tenantMembers, persistSession],
  );

  const register = useCallback(
    (agencyName: string, email: string, _password: string): boolean => {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedAgency = agencyName.trim();
      if (!normalizedEmail.includes("@") || trimmedAgency.length < 2) return false;
      const tenantId = newId("t");
      const timestamp = nowIso();
      const slug = trimmedAgency.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const pipelineId = newId("p");
      const stageNames: Array<[string, PipelineStage["stage_category"]]> = [
        ["Nuevo Lead", "open"],
        ["Contactado", "open"],
        ["Interesado", "open"],
        ["En Validación NIP", "open"],
        ["Ganado", "won"],
        ["Perdido", "lost"],
      ];
      setState((prev) => {
        const next: CrmState = { data: structuredClone(prev.data), statsDelta: prev.statsDelta };
        next.data.tenants.push({
          id: tenantId,
          name: trimmedAgency,
          slug: `${slug}-${tenantId.slice(-6)}`,
          public_webhook_token: `whk_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
          created_at: timestamp,
          updated_at: timestamp,
        });
        next.data.tenantMembers.push({
          id: newId("m"),
          tenant_id: tenantId,
          user_id: null,
          email: normalizedEmail,
          role: "owner",
          is_active: true,
          can_view_all_contacts: true,
          presence: "online",
          last_assigned_at: null,
          created_at: timestamp,
        });
        next.data.pipelines.push({
          id: pipelineId,
          tenant_id: tenantId,
          name: "Pipeline Principal",
          is_default: true,
          created_at: timestamp,
        });
        stageNames.forEach(([name, category], index) => {
          next.data.pipelineStages.push({
            id: newId("st"),
            pipeline_id: pipelineId,
            tenant_id: tenantId,
            name,
            position: index,
            stage_category: category,
            created_at: timestamp,
          });
        });
        return next;
      });
      persistSession({ email: normalizedEmail, tenantId });
      return true;
    },
    [persistSession],
  );

  const logout = useCallback(() => persistSession(null), [persistSession]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      if (!session) return;
      const membership = state.data.tenantMembers.find((m) => m.tenant_id === tenantId && m.email === session.email);
      if (!membership) return;
      persistSession({ email: session.email, tenantId });
    },
    [session, state.data.tenantMembers, persistSession],
  );

  /* ---- CRUD (delega en acciones puras con la cuenta activa) ---- */
  const requireTenant = useCallback((): string => {
    if (!activeTenantId) throw new Error("crmStore: no hay cuenta activa.");
    return activeTenantId;
  }, [activeTenantId]);

  const value = useMemo<CrmContextValue>(
    () => ({
      isHydrated,
      session,
      activeTenant,
      activeMember,
      userAccounts,
      contacts,
      conversations,
      messages,
      opportunities,
      pipelines,
      pipelineStages,
      members,
      templates,
      workflows,
      workflowEnrollments,
      aiBots,
      integrations,
      customFields,
      customValues,
      notes,
      tasks,
      activities,
      dashboardStats,
      monthlyPerformance,
      pipelineSummary,
      login,
      register,
      logout,
      switchTenant,
      createContact: (input) => setState((prev) => createContact(prev, requireTenant(), activeMember?.id ?? null, input)),
      updateContact: (contactId, patch) => setState((prev) => updateContact(prev, contactId, patch)),
      deleteContact: (contactId) => setState((prev) => deleteContact(prev, contactId)),
      toggleContactStar: (contactId) => setState((prev) => toggleContactStar(prev, contactId)),
      setContactTypification: (contactId, typification) => setState((prev) => setContactTypification(prev, contactId, typification)),
      createOpportunity: (input) => setState((prev) => createOpportunity(prev, requireTenant(), input)),
      moveOpportunityToStage: (opportunityId, targetStageId) => setState((prev) => moveOpportunityToStage(prev, opportunityId, targetStageId, prev.data.pipelineStages)),
      deleteOpportunity: (opportunityId) => setState((prev) => deleteOpportunity(prev, opportunityId)),
      sendMessage: (conversationId, input) => setState((prev) => sendMessage(prev, conversationId, { ...input, sender_member_id: activeMember?.id ?? null })),
      receiveInboundMessage: (conversationId, body, msgType) => setState((prev) => receiveInboundMessage(prev, conversationId, body, msgType)),
      assignConversation: (conversationId, memberId) => setState((prev) => assignConversation(prev, conversationId, memberId)),
      deleteConversation: (conversationId) => setState((prev) => deleteConversation(prev, conversationId)),
      addContactNote: (contactId, content) => setState((prev) => addContactNote(prev, requireTenant(), contactId, activeMember?.id ?? null, content)),
      addContactTask: (contactId, title, dueAt) => setState((prev) => addContactTask(prev, requireTenant(), contactId, activeMember?.id ?? null, title, dueAt)),
      toggleContactTask: (taskId) => setState((prev) => toggleContactTask(prev, taskId)),
      ensureConversation: (contactId) => {
        const existing = conversations.find((cv) => cv.contact_id === contactId);
        if (existing) return existing.id;
        const conversationId = newId("cv");
        setState((prev) => createConversation(prev, requireTenant(), conversationId, contactId, activeMember?.id ?? null));
        return conversationId;
      },
      addContactActivity: (contactId, activityType, description, metadata) =>
        setState((prev) => addContactActivity(prev, requireTenant(), contactId, activeMember?.id ?? null, activityType, description, metadata)),
      createWhatsappTemplate: (input) => setState((prev) => createWhatsappTemplate(prev, requireTenant(), input)),
      deleteWhatsappTemplate: (templateId) => setState((prev) => deleteWhatsappTemplate(prev, templateId)),
      createWorkflow: (input) => setState((prev) => createWorkflow(prev, requireTenant(), input)),
      toggleWorkflowStatus: (workflowId) => setState((prev) => toggleWorkflowStatus(prev, workflowId)),
      deleteWorkflow: (workflowId) => setState((prev) => deleteWorkflow(prev, workflowId)),
      updateWorkflow: (workflowId, input) => setState((prev) => updateWorkflow(prev, workflowId, input)),
      updateWorkflowNodeConfig: (workflowId, nodeId, config) => setState((prev) => updateWorkflowNodeConfig(prev, workflowId, nodeId, config)),
      addWorkflowActionNode: (workflowId, sourceNodeId, input) => setState((prev) => addWorkflowActionNode(prev, workflowId, sourceNodeId, input)),
      enrollContactInWorkflow: (workflowId, contactId, simulatedReply) =>
        setState((prev) => enrollContactInWorkflow(prev, requireTenant(), workflowId, contactId, simulatedReply)),
      inviteMember: (email, role) => setState((prev) => inviteMember(prev, requireTenant(), email, role)),
      updateMember: (memberId, patch) => setState((prev) => updateMember(prev, memberId, patch)),
      deleteMember: (memberId) => setState((prev) => deleteMember(prev, memberId)),
      createAiBot: (input) => setState((prev) => createAiBot(prev, requireTenant(), input)),
      toggleAiBot: (botId) => setState((prev) => toggleAiBot(prev, botId)),
      setIntegrationConnected: (provider, connected) => setState((prev) => setIntegrationConnected(prev, requireTenant(), provider, connected)),
      addCustomField: (input) => setState((prev) => addCustomField(prev, requireTenant(), input)),
      deleteCustomField: (fieldId) => setState((prev) => deleteCustomField(prev, fieldId)),
      addCustomValue: (valueKey, valueContent) => setState((prev) => addCustomValue(prev, requireTenant(), valueKey, valueContent)),
      deleteCustomValue: (valueId) => setState((prev) => deleteCustomValue(prev, valueId)),
    }),
    [
      isHydrated, session, activeTenant, activeMember, userAccounts,
      contacts, conversations, messages, opportunities, pipelines, pipelineStages, members,
      templates, workflows, workflowEnrollments, aiBots, integrations, customFields, customValues,
      notes, tasks, activities, dashboardStats, monthlyPerformance, pipelineSummary,
      login, register, logout, switchTenant, requireTenant,
    ],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const context = useContext(CrmContext);
  if (!context) throw new Error("useCrm debe usarse dentro de <CrmProvider>.");
  return context;
}
