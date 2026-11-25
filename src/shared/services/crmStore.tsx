"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { assignedMemberForView, contactMemberForView } from "@/shared/lib/auth/roleAccess";
import { ACTIVE_TENANT_COOKIE } from "@/shared/lib/auth/workspaceAccess";
import { createClient, isSupabaseBrowserConfigured } from "@/shared/lib/supabase/client";
import { establishSessionFromUrl } from "@/shared/lib/supabase/urlSession";
import {
  buildRoundRobinTemplateCanvas,
  buildWelcomeTemplateCanvas,
  seedTriggerCanvas,
} from "@/shared/lib/workflowEngine";
import { subscribeToInboxRealtime } from "@/shared/services/inboxRealtimeService";
import type {
  AiBot,
  Contact,
  ContactActivity,
  ContactNote,
  ContactTask,
  Conversation,
  CustomFieldDefinition,
  CustomValue,
  IntegrationProvider,
  Message,
  MessageType,
  Opportunity,
  Pipeline,
  PipelineStage,
  Tenant,
  TenantBranding,
  TenantIntegrationVault,
  TenantMember,
  WhatsAppTemplate,
  WhatsAppTemplateButton,
  Workflow,
  WorkflowEnrollment,
} from "@/shared/types/database";

const ACTIVE_TENANT_KEY = "crm-active-tenant";
const CONTACTS_PAGE_SIZE = 50;

function rememberActiveTenant(tenantId: string) {
  window.sessionStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACTIVE_TENANT_COOKIE}=${encodeURIComponent(tenantId)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

function rememberedTenant(): string | null {
  const stored = window.sessionStorage.getItem(ACTIVE_TENANT_KEY);
  if (stored) return stored;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${ACTIVE_TENANT_COOKIE}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(ACTIVE_TENANT_COOKIE.length + 1));
  } catch {
    return null;
  }
}

function forgetActiveTenant() {
  window.sessionStorage.removeItem(ACTIVE_TENANT_KEY);
  document.cookie = `${ACTIVE_TENANT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export interface CrmSession {
  email: string;
  tenantId: string;
}

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

export interface CreateContactInput {
  full_name: string;
  phone_e164: string;
  email?: string | null;
  company_name?: string | null;
  lead_source?: string;
  tags?: string[];
  assigned_member_id?: string | null;
}

export interface SendMessageInput {
  body: string;
  msg_type?: MessageType;
  template_name?: string | null;
  media_url?: string | null;
  interactive?: {
    body: string; footer?: string; header_image_url?: string | null;
    buttons: Array<{ kind: "reply" | "cta_url"; title: string; url?: string }>;
  };
}

export interface ContactQuery {
  page: number;
  search: string;
  tag: string;
  source: string;
  createdFrom: string;
  createdTo: string;
  actionFrom: string;
  actionTo: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
  loginPath?: string;
}

export type ContactPatch = Partial<Pick<Contact,
  "full_name" | "phone_e164" | "email" | "company_name" | "lead_source" | "tags" | "custom_fields" | "assigned_member_id"
>>;
export type MemberPatch = Partial<Pick<TenantMember, "is_active" | "can_view_all_contacts" | "presence">>;
export type CreateOpportunityInput = Pick<Opportunity, "contact_id" | "pipeline_id" | "stage_id" | "title" | "monetary_value"> & { assigned_member_id?: string | null };
export type CreateTemplateInput = Pick<WhatsAppTemplate, "name" | "category" | "language" | "body_text" | "variables_count"> & {
  footer_text?: string | null;
  header_type?: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT";
  header_content?: string | null;
  buttons?: WhatsAppTemplateButton[];
  variable_mappings?: Array<{ slot: string; label: string; crmField: string }>;
  default_header_media_url?: string | null;
};
export type CreateWorkflowInput = Pick<Workflow, "name" | "trigger_type"> & { description?: string | null };
export type UpdateWorkflowInput = Partial<Pick<Workflow, "name" | "description" | "allow_reenrollment">>;
export type CreateAiBotInput = Pick<AiBot, "name" | "product_line" | "provider" | "system_prompt" | "model_name" | "fallback_models" | "priority" | "bot_role" | "trigger_keywords">;
export type UpdateAiBotInput = Pick<AiBot, "name" | "product_line" | "provider" | "system_prompt" | "model_name" | "fallback_models" | "priority" | "bot_role" | "trigger_keywords">;
export type CreateCustomFieldInput = Pick<CustomFieldDefinition, "field_key" | "field_label" | "field_type"> & { options?: string[] };
export type SimulatedReply = "Si" | "No" | "Otra respuesta" | "Undelivered" | "Time Out";
export type AddWorkflowActionNodeInput = { label: string; config: Record<string, string>; edgeLabel?: string | null };
export type AddWorkflowInitialNodeInput = { label: string; config: Record<string, string>; type?: "trigger" | "action" };

interface CrmData {
  contacts: Contact[];
  customFieldDefinitions: CustomFieldDefinition[];
  customValues: CustomValue[];
  pipelines: Pipeline[];
  pipelineStages: PipelineStage[];
  opportunities: Opportunity[];
  conversations: Conversation[];
  messages: Message[];
  contactNotes: ContactNote[];
  tenantMembers: TenantMember[];
  contactTasks: ContactTask[];
  contactActivities: ContactActivity[];
  whatsappTemplates: WhatsAppTemplate[];
  workflows: Workflow[];
  workflowEnrollments: WorkflowEnrollment[];
  aiBots: AiBot[];
  integrationsVault: TenantIntegrationVault[];
}

interface CrmContextValue {
  isHydrated: boolean;
  isPlatformSuperadmin: boolean;
  isLoadingData: boolean;
  isMutating: boolean;
  dataError: string | null;
  session: CrmSession | null;
  activeTenant: Tenant | null;
  activeMember: TenantMember | null;
  userAccounts: UserAccount[];
  availableTenants: Tenant[];
  viewingAsMemberId: string | null;
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  opportunities: Opportunity[];
  pipelines: Pipeline[];
  pipelineStages: PipelineStage[];
  members: TenantMember[];
  templates: WhatsAppTemplate[];
  workflows: Workflow[];
  workflowEnrollments: WorkflowEnrollment[];
  aiBots: AiBot[];
  integrations: TenantIntegrationVault[];
  customFields: CustomFieldDefinition[];
  customValues: CustomValue[];
  notes: ContactNote[];
  tasks: ContactTask[];
  activities: ContactActivity[];
  dashboardStats: DashboardStats;
  monthlyPerformance: MonthlyPerformancePoint[];
  pipelineSummary: PipelineStageSummary[];
  contactTotal: number;
  contactPageSize: number;
  contactQuery: ContactQuery;
  setContactQuery: (patch: Partial<ContactQuery>) => void;
  login: (email: string, password: string, workspaceSlug?: string | null) => Promise<AuthResult>;
  register: (agencyName: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  setViewingAsMemberId: (memberId: string | null) => void;
  refreshData: () => Promise<void>;
  updateActiveTenantBranding: (branding: TenantBranding) => void;
  createContact: (input: CreateContactInput) => void;
  importContacts: (inputs: CreateContactInput[]) => Promise<{ imported: number; failed: number }>;
  updateContact: (contactId: string, patch: ContactPatch) => void;
  deleteContact: (contactId: string) => void;
  toggleContactStar: (contactId: string) => void;
  setContactTypification: (contactId: string, typification: string | null) => void;
  createOpportunity: (input: CreateOpportunityInput) => void;
  moveOpportunityToStage: (opportunityId: string, targetStageId: string) => void;
  deleteOpportunity: (opportunityId: string) => void;
  sendMessage: (conversationId: string, input: SendMessageInput) => Promise<void>;
  setConversationHandler: (conversationId: string, handlerMode: Conversation["handler_mode"]) => void;
  assignConversation: (conversationId: string, memberId: string | null) => void;
  deleteConversation: (conversationId: string) => void;
  addContactNote: (contactId: string, content: string) => void;
  addContactTask: (contactId: string, title: string, dueAt: string | null) => void;
  toggleContactTask: (taskId: string) => void;
  ensureConversation: (contactId: string) => Promise<string>;
  addContactActivity: (contactId: string, activityType: string, description: string, metadata?: Record<string, string>) => void;
  createWhatsappTemplate: (input: CreateTemplateInput) => Promise<void>;
  deleteWhatsappTemplate: (templateId: string) => void;
  createWorkflow: (input: CreateWorkflowInput) => void;
  createWorkflowTemplate: (variant: "bienvenida" | "reparto") => void;
  toggleWorkflowStatus: (workflowId: string) => void;
  deleteWorkflow: (workflowId: string) => void;
  updateWorkflow: (workflowId: string, input: UpdateWorkflowInput) => void;
  updateWorkflowNodeConfig: (workflowId: string, nodeId: string, config: Record<string, string>) => void;
  addWorkflowActionNode: (workflowId: string, sourceNodeId: string, input: AddWorkflowActionNodeInput) => void;
  addWorkflowInitialNode: (workflowId: string, input: AddWorkflowInitialNodeInput) => void;
  enrollContactInWorkflow: (workflowId: string, contactId: string, simulatedReply: SimulatedReply | null) => void;
  inviteMember: (email: string, role: TenantMember["role"]) => Promise<void>;
  updateMember: (memberId: string, patch: MemberPatch) => void;
  deleteMember: (memberId: string) => void;
  createAiBot: (input: CreateAiBotInput) => void;
  toggleAiBot: (botId: string) => void;
  deleteAiBot: (botId: string) => void;
  updateAiBot: (botId: string, input: UpdateAiBotInput) => void;
  updateTenantBotDefault: (patch: { default_new_contact_mode?: "bot" | "human"; default_bot_id?: string | null }) => void;
  setIntegrationConnected: (provider: IntegrationProvider, connected: boolean, credentials?: Record<string, string>) => Promise<void>;
  addCustomField: (input: CreateCustomFieldInput) => void;
  updateCustomField: (fieldId: string, input: Omit<CreateCustomFieldInput, "field_key">) => void;
  deleteCustomField: (fieldId: string) => void;
  addCustomValue: (valueKey: string, valueContent: string) => void;
  deleteCustomValue: (valueId: string) => void;
}

const EMPTY_DATA: CrmData = {
  contacts: [], customFieldDefinitions: [], customValues: [], pipelines: [], pipelineStages: [],
  opportunities: [], conversations: [], messages: [], contactNotes: [], tenantMembers: [], contactTasks: [], contactActivities: [],
  whatsappTemplates: [], workflows: [], workflowEnrollments: [], aiBots: [], integrationsVault: [],
};

const EMPTY_CONTACT_QUERY: ContactQuery = {
  page: 0, search: "", tag: "all", source: "all", createdFrom: "", createdTo: "", actionFrom: "", actionTo: "",
};

const CrmContext = createContext<CrmContextValue | null>(null);

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function cleanSearch(value: string): string {
  return value.trim().replace(/[%_,().\\]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CrmData>(EMPTY_DATA);
  const [memberships, setMemberships] = useState<TenantMember[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [session, setSession] = useState<CrmSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPlatformSuperadmin, setIsPlatformSuperadmin] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [contactTotal, setContactTotal] = useState(0);
  const [workspaceContactTotal, setWorkspaceContactTotal] = useState(0);
  const [contactQuery, setContactQueryState] = useState<ContactQuery>(EMPTY_CONTACT_QUERY);
  const [viewingAsMemberId, setViewingAsMemberIdState] = useState<string | null>(null);
  const workspaceRequest = useRef(0);
  const contactRequest = useRef(0);

  const activeTenantId = session?.tenantId ?? null;
  const activeTenant = useMemo(() => tenants.find((tenant) => tenant.id === activeTenantId) ?? null, [tenants, activeTenantId]);
  const activeMember = useMemo(() => memberships.find((member) => member.tenant_id === activeTenantId) ?? null, [memberships, activeTenantId]);
  /* Primitivos estables: evita recargas en bucle cuando el objeto del miembro cambia de referencia. */
  const activeMemberId = activeMember?.id ?? null;
  const activeMemberRole = activeMember?.role ?? null;
  const activeMemberCanViewAll = activeMember?.can_view_all_contacts ?? null;
  const userAccounts = useMemo<UserAccount[]>(() => memberships.flatMap((member) => {
    const tenant = tenants.find((item) => item.id === member.tenant_id);
    return tenant ? [{ tenant, memberId: member.id, role: member.role }] : [];
  }), [memberships, tenants]);

  const clearSession = useCallback(() => {
    setSession(null);
    setMemberships([]);
    setTenants([]);
    setIsPlatformSuperadmin(false);
    setViewingAsMemberIdState(null);
    setData(EMPTY_DATA);
    setContactTotal(0);
    setWorkspaceContactTotal(0);
    forgetActiveTenant();
  }, []);

  const loadMemberships = useCallback(async (user: User, preferredTenantId?: string): Promise<string | null> => {
    const supabase = createClient();
    const email = user.email?.toLowerCase();
    if (!email) {
      const message = "La cuenta de autenticación no tiene un correo electrónico.";
      clearSession();
      setDataError(message);
      setIsHydrated(true);
      return message;
    }
    const [memberResult, superadminResult] = await Promise.all([
      supabase.from("tenant_members").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.rpc("is_platform_superadmin"),
    ]);
    if (memberResult.error) {
      const message = "No se pudieron cargar tus membresías. Inténtalo de nuevo.";
      clearSession();
      setDataError(message);
      setIsHydrated(true);
      return message;
    }
    const nextMemberships = rows<TenantMember>(memberResult.data);
    const superadmin = !superadminResult.error && superadminResult.data === true;
    if (nextMemberships.length === 0 && !superadmin) {
      const message = "Tu usuario aún no pertenece a un espacio de trabajo. Solicita una invitación al administrador.";
      clearSession();
      setDataError(message);
      setIsHydrated(true);
      return message;
    }
    let tenantQuery = supabase.from("tenants").select("id,name,slug,branding,status,default_new_contact_mode,default_bot_id,created_at,updated_at");
    if (!superadmin) tenantQuery = tenantQuery.in("id", nextMemberships.map((member) => member.tenant_id));
    const tenantResult = await tenantQuery;
    if (tenantResult.error) {
      const message = "No se pudieron cargar los espacios de trabajo.";
      clearSession();
      setDataError(message);
      setIsHydrated(true);
      return message;
    }
    const nextTenants = rows<Tenant>(tenantResult.data).filter((tenant) => superadmin || tenant.status !== "suspended");
    const allowedIds = new Set(nextTenants.map((tenant) => tenant.id));
    const allowedMemberships = nextMemberships.filter((member) => allowedIds.has(member.tenant_id));
    if ((!superadmin && allowedMemberships.length === 0) || (superadmin && nextTenants.length === 0)) {
      const message = "El espacio de trabajo está suspendido o no está disponible.";
      clearSession();
      setDataError(message);
      setIsHydrated(true);
      return message;
    }
    const remembered = preferredTenantId ?? rememberedTenant();
    const defaultTenantId = superadmin
      ? (nextTenants.find((tenant) => tenant.slug === "adlive") ?? nextTenants[0])!.id
      : allowedMemberships[0]!.tenant_id;
    const canUseRemembered = nextTenants.some((tenant) => tenant.id === remembered)
      && (superadmin || allowedMemberships.some((member) => member.tenant_id === remembered));
    const tenantId = canUseRemembered ? remembered! : defaultTenantId;
    setMemberships(superadmin ? nextMemberships : allowedMemberships);
    setTenants(nextTenants);
    setIsPlatformSuperadmin(superadmin);
    setViewingAsMemberIdState(null);
    setSession({ email, tenantId });
    rememberActiveTenant(tenantId);
    setDataError(null);
    setIsHydrated(true);
    return null;
  }, [clearSession]);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setDataError("Faltan las variables públicas de Supabase. Revisa la configuración del entorno.");
      setIsHydrated(true);
      return;
    }
    const supabase = createClient();
    let mounted = true;
    void (async () => {
      await establishSessionFromUrl(supabase);
      if (!mounted) return;
      const { data: authData, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !authData.user) {
        clearSession();
        setIsHydrated(true);
        return;
      }
      void loadMemberships(authData.user);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      window.setTimeout(() => {
        if (!mounted) return;
        if (authSession?.user) void loadMemberships(authSession.user);
        else {
          clearSession();
          setIsHydrated(true);
        }
      }, 0);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearSession, loadMemberships]);

  const loadedWorkspaceFor = useRef<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!activeTenantId || (!activeMemberId && !isPlatformSuperadmin)) {
      setData(EMPTY_DATA);
      return;
    }
    const requestId = ++workspaceRequest.current;
    const assignedMemberId = assignedMemberForView(activeMemberRole, activeMemberId, viewingAsMemberId);
    const contactMemberId = contactMemberForView(activeMemberRole, activeMemberId, activeMemberCanViewAll, viewingAsMemberId);
    const workspaceViewKey = `${activeTenantId}:${assignedMemberId ?? "all"}:${contactMemberId ?? "all"}`;
    /* El indicador de carga solo aparece al cambiar de workspace o vista;
       las sincronizaciones en segundo plano son silenciosas. */
    const isInitialLoad = loadedWorkspaceFor.current !== workspaceViewKey;
    if (isInitialLoad) setIsLoadingData(true);
    const supabase = createClient();
    const tenantId = activeTenantId;
    const canReadIntegrations = isPlatformSuperadmin || ["owner", "admin"].includes(activeMemberRole ?? "");
    let opportunityQuery = supabase.from("opportunities").select("*").eq("tenant_id", tenantId);
    let conversationQuery = supabase.from("conversations").select("*").eq("tenant_id", tenantId).order("last_message_at", { ascending: false });
    let contactCountQuery = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    if (assignedMemberId) {
      opportunityQuery = opportunityQuery.eq("assigned_member_id", assignedMemberId);
      conversationQuery = conversationQuery.eq("assigned_member_id", assignedMemberId);
    }
    if (contactMemberId) contactCountQuery = contactCountQuery.eq("assigned_member_id", contactMemberId);
    try {
      const [pipelineR, stageR, opportunityR, conversationR, messageR, memberR, templateR, workflowR, enrollmentR, botR, fieldR, valueR, noteR, taskR, activityR, contactCountR, integrationResponse] = await Promise.all([
        supabase.from("pipelines").select("*").eq("tenant_id", tenantId),
        supabase.from("pipeline_stages").select("*").eq("tenant_id", tenantId).order("position"),
        opportunityQuery,
        conversationQuery,
        supabase.from("messages").select("*").eq("tenant_id", tenantId).order("created_at").limit(2000),
        supabase.from("tenant_members").select("*").eq("tenant_id", tenantId).order("created_at"),
        supabase.from("whatsapp_templates").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("workflows").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("workflow_enrollments").select("*").eq("tenant_id", tenantId).order("enrolled_at", { ascending: false }).limit(1000),
        supabase.from("ai_bots").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("custom_field_definitions").select("*").eq("tenant_id", tenantId).order("created_at"),
        supabase.from("custom_values").select("*").eq("tenant_id", tenantId).order("created_at"),
        supabase.from("contact_notes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
        supabase.from("contact_tasks").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
        supabase.from("contact_activities").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
        contactCountQuery,
        canReadIntegrations
          ? fetch(`/api/v1/integrations?tenantId=${encodeURIComponent(tenantId)}${["owner", "admin"].includes(activeMemberRole ?? "") ? "&includeWebhookToken=1" : ""}`, { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      const failed = [pipelineR, stageR, opportunityR, conversationR, messageR, memberR, templateR, workflowR, enrollmentR, botR, fieldR, valueR, noteR, taskR, activityR, contactCountR].find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
      if (integrationResponse && !integrationResponse.ok) throw new Error("No se pudieron cargar las integraciones del espacio de trabajo.");
      const integrationResult = integrationResponse
        ? await integrationResponse.json() as { integrations?: TenantIntegrationVault[] }
        : { integrations: [] };
      if (requestId !== workspaceRequest.current) return;
      setData((previous) => ({
        ...previous,
        pipelines: rows<Pipeline>(pipelineR.data), pipelineStages: rows<PipelineStage>(stageR.data),
        opportunities: rows<Opportunity>(opportunityR.data).map((item) => ({ ...item, monetary_value: Number(item.monetary_value) })),
        conversations: rows<Conversation>(conversationR.data), messages: rows<Message>(messageR.data),
        whatsappTemplates: rows<WhatsAppTemplate>(templateR.data), workflows: rows<Workflow>(workflowR.data),
        workflowEnrollments: rows<WorkflowEnrollment>(enrollmentR.data), aiBots: rows<AiBot>(botR.data),
        integrationsVault: rows<TenantIntegrationVault>(integrationResult.integrations),
        customFieldDefinitions: rows<CustomFieldDefinition>(fieldR.data), customValues: rows<CustomValue>(valueR.data),
        contactNotes: rows<ContactNote>(noteR.data), tenantMembers: rows<TenantMember>(memberR.data),
        contactTasks: rows<ContactTask>(taskR.data), contactActivities: rows<ContactActivity>(activityR.data),
      }));
      setMemberships((previous) => previous.map((member) => {
        if (member.tenant_id !== tenantId) return member;
        const fresh = rows<TenantMember>(memberR.data).find((item) => item.id === member.id);
        /* Conservar la referencia si nada cambió evita re-renderizados y recargas en cascada. */
        return fresh && JSON.stringify(fresh) !== JSON.stringify(member) ? fresh : member;
      }));
      setWorkspaceContactTotal(contactCountR.count ?? 0);
      loadedWorkspaceFor.current = workspaceViewKey;
      setDataError(null);
    } catch (error) {
      if (requestId === workspaceRequest.current) setDataError(`No se pudieron cargar los datos: ${errorMessage(error)}`);
    } finally {
      if (requestId === workspaceRequest.current) setIsLoadingData(false);
    }
  }, [activeMemberCanViewAll, activeMemberId, activeMemberRole, activeTenantId, isPlatformSuperadmin, viewingAsMemberId]);

  const loadContacts = useCallback(async () => {
    if (!activeTenantId || (!activeMemberId && !isPlatformSuperadmin)) {
      setData((previous) => ({ ...previous, contacts: [] }));
      setContactTotal(0);
      return;
    }
    const requestId = ++contactRequest.current;
    const supabase = createClient();
    const page = Math.max(0, contactQuery.page);
    const contactMemberId = contactMemberForView(activeMemberRole, activeMemberId, activeMemberCanViewAll, viewingAsMemberId);
    let query = supabase.from("contacts").select("*", { count: "exact" }).eq("tenant_id", activeTenantId);
    if (contactMemberId) query = query.eq("assigned_member_id", contactMemberId);
    const search = cleanSearch(contactQuery.search);
    if (search) query = query.or(`full_name.ilike.%${search}%,phone_e164.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
    if (contactQuery.tag !== "all") query = query.contains("tags", [contactQuery.tag]);
    if (contactQuery.source !== "all") query = query.eq("lead_source", contactQuery.source);
    if (contactQuery.createdFrom) query = query.gte("created_at", `${contactQuery.createdFrom}T00:00:00.000Z`);
    if (contactQuery.createdTo) query = query.lte("created_at", `${contactQuery.createdTo}T23:59:59.999Z`);
    if (contactQuery.actionFrom) query = query.gte("last_interaction_at", `${contactQuery.actionFrom}T00:00:00.000Z`);
    if (contactQuery.actionTo) query = query.lte("last_interaction_at", `${contactQuery.actionTo}T23:59:59.999Z`);
    const { data: result, count, error } = await query.order("created_at", { ascending: false }).range(page * CONTACTS_PAGE_SIZE, page * CONTACTS_PAGE_SIZE + CONTACTS_PAGE_SIZE - 1);
    if (requestId !== contactRequest.current) return;
    if (error) {
      setDataError(`No se pudieron cargar los contactos: ${error.message}`);
      return;
    }
    setData((previous) => ({ ...previous, contacts: rows<Contact>(result) }));
    setContactTotal(count ?? 0);
  }, [activeMemberCanViewAll, activeMemberId, activeMemberRole, activeTenantId, contactQuery, isPlatformSuperadmin, viewingAsMemberId]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => { void loadContacts(); }, [loadContacts]);

  useEffect(() => {
    if (!activeTenantId || (!activeMemberId && !isPlatformSuperadmin)) return;
    let disposed = false;
    let syncRunning = false;
    const tenantId = activeTenantId;
    const assignedMemberId = assignedMemberForView(activeMemberRole, activeMemberId, viewingAsMemberId);
    const contactMemberId = contactMemberForView(activeMemberRole, activeMemberId, activeMemberCanViewAll, viewingAsMemberId);
    const upsert = <T extends { id: string }>(items: T[], item: T): T[] => {
      const index = items.findIndex((current) => current.id === item.id);
      if (index < 0) return [item, ...items];
      const next = items.slice();
      next[index] = item;
      return next;
    };

    /* Realtime da la actualización inmediata. Esta consulta ligera es un respaldo
       silencioso para no dejar contactos nuevos invisibles si un evento se pierde. */
    const syncInbox = async () => {
      if (disposed || syncRunning || document.visibilityState !== "visible") return;
      syncRunning = true;
      try {
        const supabase = createClient();
        let conversationQuery = supabase.from("conversations").select("*")
          .eq("tenant_id", tenantId).order("last_message_at", { ascending: false });
        if (assignedMemberId) conversationQuery = conversationQuery.eq("assigned_member_id", assignedMemberId);
        const [conversationR, messageR] = await Promise.all([
          conversationQuery,
          supabase.from("messages").select("*").eq("tenant_id", tenantId).order("created_at").limit(2000),
          loadContacts(),
        ]);
        if (disposed || conversationR.error || messageR.error) return;
        setData((previous) => ({
          ...previous,
          conversations: rows<Conversation>(conversationR.data),
          messages: rows<Message>(messageR.data),
        }));
      } finally {
        syncRunning = false;
      }
    };
    const handleFocus = () => { void syncInbox(); };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncInbox();
    };
    const unsubscribe = subscribeToInboxRealtime(tenantId, {
      onContact: (contact) => {
        if (contactMemberId && contact.assigned_member_id !== contactMemberId) return;
        /* Recargar respeta búsqueda, filtros, paginación y el total del servidor. */
        void loadContacts();
      },
      onConversation: (conversation) => {
        if (assignedMemberId && conversation.assigned_member_id !== assignedMemberId) return;
        setData((previous) => ({ ...previous, conversations: upsert(previous.conversations, conversation) }));
        /* También cubre una conversación cuyo evento de contacto no haya llegado. */
        void loadContacts();
      },
      onMessage: (message) => setData((previous) => {
        if (assignedMemberId && !previous.conversations.some((item) => item.id === message.conversation_id)) return previous;
        return { ...previous, messages: upsert(previous.messages, message).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
      }),
    });
    const interval = window.setInterval(() => { void syncInbox(); }, 15_000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe?.();
    };
  }, [activeMemberCanViewAll, activeMemberId, activeMemberRole, activeTenantId, isPlatformSuperadmin, loadContacts, viewingAsMemberId]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadWorkspace(), loadContacts()]);
  }, [loadContacts, loadWorkspace]);

  const updateActiveTenantBranding = useCallback((branding: TenantBranding) => {
    if (!activeTenantId) return;
    setTenants((previous) => previous.map((tenant) => tenant.id === activeTenantId ? { ...tenant, branding } : tenant));
  }, [activeTenantId]);

  const runMutationAsync = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    setIsMutating(true);
    setDataError(null);
    try {
      await operation();
      await refreshData();
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    } finally {
      setIsMutating(false);
    }
  }, [refreshData]);

  const runMutation = useCallback((operation: () => Promise<void>) => {
    void runMutationAsync(operation).catch(() => undefined);
  }, [runMutationAsync]);

  const requireTenant = useCallback((): string => {
    if (!activeTenantId || (!activeMember && !isPlatformSuperadmin)) throw new Error("No hay un espacio de trabajo activo.");
    return activeTenantId;
  }, [activeMember, activeTenantId, isPlatformSuperadmin]);

  const setIntegrationConnected = useCallback(async (
    provider: IntegrationProvider,
    connected: boolean,
    credentials?: Record<string, string>,
  ): Promise<void> => {
    setIsMutating(true);
    setDataError(null);
    try {
      const response = await fetch("/api/v1/integrations", {
        method: connected ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: requireTenant(), provider, ...(connected ? { credentials: credentials ?? {} } : {}) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar la integración.");
      await refreshData();
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    } finally {
      setIsMutating(false);
    }
  }, [refreshData, requireTenant]);

  const login = useCallback(async (email: string, password: string, workspaceSlug?: string | null): Promise<AuthResult> => {
    try {
      const response = await fetch("/api/v1/auth/workspace-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, workspaceSlug: workspaceSlug || null }),
      });
      const result = await response.json() as { error?: string; tenantId?: string };
      if (!response.ok || !result.tenantId) return { ok: false, error: result.error ?? "No se pudo iniciar sesión." };
      rememberActiveTenant(result.tenantId);
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        await supabase.auth.signOut();
        forgetActiveTenant();
        return { ok: false, error: "No se pudo establecer la sesión. Inténtalo de nuevo." };
      }
      const membershipError = await loadMemberships(authData.user, result.tenantId);
      if (membershipError) {
        await supabase.auth.signOut();
        return { ok: false, error: membershipError };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo iniciar sesión. Revisa la configuración e inténtalo de nuevo." };
    }
  }, [loadMemberships]);

  const register = useCallback(async (agencyName: string, email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch("/api/v1/auth/bootstrap-tenant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName, email, password }),
      });
      const result = await response.json() as { error?: string; requiresEmailConfirmation?: boolean; loginPath?: string };
      if (!response.ok) return { ok: false, error: result.error ?? "No se pudo crear la cuenta." };
      return { ok: true, requiresEmailConfirmation: result.requiresEmailConfirmation, loginPath: result.loginPath };
    } catch {
      return { ok: false, error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
    }
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseBrowserConfigured()) await createClient().auth.signOut();
    clearSession();
  }, [clearSession]);

  const switchTenant = useCallback((tenantId: string) => {
    const allowed = memberships.some((member) => member.tenant_id === tenantId)
      || (isPlatformSuperadmin && tenants.some((tenant) => tenant.id === tenantId));
    if (!session || !allowed) return;
    setData(EMPTY_DATA);
    setViewingAsMemberIdState(null);
    setContactQueryState(EMPTY_CONTACT_QUERY);
    setSession({ ...session, tenantId });
    rememberActiveTenant(tenantId);
  }, [isPlatformSuperadmin, memberships, session, tenants]);

  const setViewingAsMemberId = useCallback((memberId: string | null) => {
    const canViewAs = isPlatformSuperadmin || activeMemberRole === "owner" || activeMemberRole === "admin";
    const validMember = memberId === null || data.tenantMembers.some((member) => member.id === memberId && member.tenant_id === activeTenantId && member.is_active);
    if (!session || !canViewAs || !validMember) return;
    setViewingAsMemberIdState(memberId);
    setContactQueryState(EMPTY_CONTACT_QUERY);
    setData((previous) => ({ ...previous, contacts: [], opportunities: [], conversations: [], messages: [] }));
    setContactTotal(0);
  }, [activeMemberRole, activeTenantId, data.tenantMembers, isPlatformSuperadmin, session]);

  const setContactQuery = useCallback((patch: Partial<ContactQuery>) => {
    setContactQueryState((previous) => ({ ...previous, ...patch, page: patch.page ?? (Object.keys(patch).some((key) => key !== "page") ? 0 : previous.page) }));
  }, []);

  const importContacts = useCallback(async (inputs: CreateContactInput[]) => {
    const tenantId = requireTenant();
    if (!activeMember) return { imported: 0, failed: inputs.length };
    const payload = inputs.map((input) => ({
      tenant_id: tenantId,
      assigned_member_id: input.assigned_member_id ?? (activeMember.role === "agent" ? activeMember.id : null),
      full_name: input.full_name.trim(), phone_e164: input.phone_e164.replace(/\D/g, ""),
      email: input.email?.trim() || null, company_name: input.company_name?.trim() || null,
      lead_source: input.lead_source?.trim() || "WhatsApp", tags: input.tags ?? [], custom_fields: {},
    }));
    const { error } = await createClient().from("contacts").insert(payload);
    if (error) {
      setDataError(`No se importaron los contactos: ${error.message}`);
      return { imported: 0, failed: inputs.length };
    }
    await refreshData();
    return { imported: inputs.length, failed: 0 };
  }, [activeMember, refreshData, requireTenant]);

  const dashboardStats = useMemo<DashboardStats>(() => ({
    totalContacts: workspaceContactTotal,
    openOpportunities: data.opportunities.filter((item) => item.status === "open").length,
    totalRevenue: data.opportunities.filter((item) => item.status === "won").reduce((sum, item) => sum + item.monetary_value, 0),
    unanswered: data.conversations.filter((item) => item.needs_reply).length,
  }), [data.conversations, data.opportunities, workspaceContactTotal]);

  const monthlyPerformance = useMemo<MonthlyPerformancePoint[]>(() => {
    const months = new Map<string, MonthlyPerformancePoint>();
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const monthKey = date.toISOString().slice(0, 7);
      months.set(monthKey, { monthKey, ganadas: 0, perdidas: 0 });
    }
    for (const opportunity of data.opportunities) {
      if (opportunity.status === "open" || !opportunity.closed_at) continue;
      const point = months.get(opportunity.closed_at.slice(0, 7));
      if (!point) continue;
      if (opportunity.status === "won") point.ganadas += 1;
      if (opportunity.status === "lost") point.perdidas += 1;
    }
    return [...months.values()];
  }, [data.opportunities]);

  const pipelineStages = useMemo(() => data.pipelineStages.slice().sort((a, b) => a.position - b.position), [data.pipelineStages]);
  const pipelineSummary = useMemo<PipelineStageSummary[]>(() => pipelineStages.filter((stage) => stage.stage_category === "open").map((stage) => {
    const items = data.opportunities.filter((item) => item.stage_id === stage.id && item.status === "open");
    return { stage, count: items.length, totalValue: items.reduce((sum, item) => sum + item.monetary_value, 0) };
  }), [data.opportunities, pipelineStages]);

  const visibleMessages = useMemo(() => {
    const assignedMemberId = assignedMemberForView(activeMemberRole, activeMemberId, viewingAsMemberId);
    if (!assignedMemberId) return data.messages;
    const conversationIds = new Set(data.conversations.map((item) => item.id));
    return data.messages.filter((message) => conversationIds.has(message.conversation_id));
  }, [activeMemberId, activeMemberRole, data.conversations, data.messages, viewingAsMemberId]);

  const value = useMemo<CrmContextValue>(() => ({
    isHydrated, isPlatformSuperadmin, isLoadingData, isMutating, dataError, session, activeTenant, activeMember, userAccounts,
    availableTenants: tenants, viewingAsMemberId,
    contacts: data.contacts, conversations: data.conversations, messages: visibleMessages, opportunities: data.opportunities,
    pipelines: data.pipelines, pipelineStages, members: data.tenantMembers,
    templates: data.whatsappTemplates, workflows: data.workflows, workflowEnrollments: data.workflowEnrollments,
    aiBots: data.aiBots, integrations: data.integrationsVault, customFields: data.customFieldDefinitions,
    customValues: data.customValues, notes: data.contactNotes, tasks: data.contactTasks, activities: data.contactActivities,
    dashboardStats, monthlyPerformance, pipelineSummary, contactTotal, contactPageSize: CONTACTS_PAGE_SIZE,
    contactQuery, setContactQuery, login, register, logout, switchTenant, setViewingAsMemberId, refreshData, updateActiveTenantBranding,
    createContact: (input) => runMutation(async () => {
      const tenantId = requireTenant();
      const { error } = await createClient().from("contacts").insert({
        tenant_id: tenantId, assigned_member_id: input.assigned_member_id ?? (activeMember?.role === "agent" ? activeMember.id : null),
        full_name: input.full_name.trim(), phone_e164: input.phone_e164.replace(/\D/g, ""), email: input.email?.trim() || null,
        company_name: input.company_name?.trim() || null, lead_source: input.lead_source?.trim() || "WhatsApp",
        tags: input.tags ?? [], custom_fields: {}, last_interaction_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }),
    importContacts,
    updateContact: (contactId, patch) => runMutation(async () => {
      const { error } = await createClient().from("contacts").update(patch).eq("id", contactId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    deleteContact: (contactId) => runMutation(async () => {
      const { error } = await createClient().from("contacts").delete().eq("id", contactId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    toggleContactStar: (contactId) => runMutation(async () => {
      const contact = data.contacts.find((item) => item.id === contactId);
      if (!contact) return;
      const { error } = await createClient().from("contacts").update({ is_starred: !contact.is_starred }).eq("id", contactId);
      if (error) throw new Error(error.message);
    }),
    setContactTypification: (contactId, typification) => runMutation(async () => {
      const { error } = await createClient().from("contacts").update({ typification }).eq("id", contactId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    createOpportunity: (input) => runMutation(async () => {
      const { error } = await createClient().from("opportunities").insert({
        ...input, tenant_id: requireTenant(), assigned_member_id: input.assigned_member_id ?? (activeMember?.role === "agent" ? activeMember.id : null), status: "open",
      });
      if (error) throw new Error(error.message);
    }),
    moveOpportunityToStage: (opportunityId, targetStageId) => runMutation(async () => {
      const stage = pipelineStages.find((item) => item.id === targetStageId);
      const opportunity = data.opportunities.find((item) => item.id === opportunityId);
      if (!stage || !opportunity) return;
      const closedAt = stage.stage_category === "open" ? null : new Date().toISOString();
      const { error } = await createClient().from("opportunities").update({ stage_id: targetStageId, status: stage.stage_category, closed_at: closedAt }).eq("id", opportunityId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
      if (stage.stage_category === "won") await createClient().from("contacts").update({ is_closed_client: true, typification: "Cliente cerrado" }).eq("id", opportunity.contact_id);
    }),
    deleteOpportunity: (opportunityId) => runMutation(async () => {
      const { error } = await createClient().from("opportunities").delete().eq("id", opportunityId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    sendMessage: (conversationId, input) => runMutationAsync(async () => {
      const response = await fetch("/api/v1/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, ...input }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el mensaje.");
    }),
    setConversationHandler: (conversationId, handlerMode) => runMutation(async () => {
      const { error } = await createClient().from("conversations").update({ handler_mode: handlerMode })
        .eq("id", conversationId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    assignConversation: (conversationId, memberId) => runMutation(async () => {
      const conversation = data.conversations.find((item) => item.id === conversationId);
      if (!conversation) return;
      const supabase = createClient();
      const { error } = await supabase.from("conversations").update({ assigned_member_id: memberId }).eq("id", conversationId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
      const contactResult = await supabase.from("contacts").update({ assigned_member_id: memberId }).eq("id", conversation.contact_id);
      if (contactResult.error) throw new Error(contactResult.error.message);
    }),
    deleteConversation: (conversationId) => runMutation(async () => {
      const { error } = await createClient().from("conversations").delete().eq("id", conversationId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    addContactNote: (contactId, content) => runMutation(async () => {
      const { error } = await createClient().from("contact_notes").insert({ tenant_id: requireTenant(), contact_id: contactId, author_member_id: activeMember?.id, content: content.trim() });
      if (error) throw new Error(error.message);
    }),
    addContactTask: (contactId, title, dueAt) => runMutation(async () => {
      const { error } = await createClient().from("contact_tasks").insert({ tenant_id: requireTenant(), contact_id: contactId, assigned_member_id: activeMember?.id, title: title.trim(), due_at: dueAt });
      if (error) throw new Error(error.message);
    }),
    toggleContactTask: (taskId) => runMutation(async () => {
      const task = data.contactTasks.find((item) => item.id === taskId);
      if (!task) return;
      const { error } = await createClient().from("contact_tasks").update({ is_completed: !task.is_completed }).eq("id", taskId);
      if (error) throw new Error(error.message);
    }),
    ensureConversation: async (contactId) => {
      const existing = data.conversations.find((item) => item.contact_id === contactId);
      if (existing) return existing.id;
      const conversationId = crypto.randomUUID();
      await runMutationAsync(async () => {
        const { error } = await createClient().from("conversations").insert({ id: conversationId, tenant_id: requireTenant(), contact_id: contactId, assigned_member_id: activeMember?.id ?? null, channel: "whatsapp", handler_mode: "human" });
        if (error) throw new Error(error.message);
      });
      return conversationId;
    },
    addContactActivity: (contactId, activityType, description, metadata = {}) => runMutation(async () => {
      const { error } = await createClient().from("contact_activities").insert({ tenant_id: requireTenant(), contact_id: contactId, actor_member_id: activeMember?.id, activity_type: activityType, description: description.trim(), metadata });
      if (error) throw new Error(error.message);
    }),
    createWhatsappTemplate: (input) => runMutationAsync(async () => {
      const response = await fetch("/api/v1/whatsapp/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: requireTenant(), ...input }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear la plantilla en Meta.");
    }),
    deleteWhatsappTemplate: (templateId) => runMutation(async () => {
      const { error } = await createClient().from("whatsapp_templates").delete().eq("id", templateId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    createWorkflow: (input) => runMutation(async () => {
      // QA-001: siembra el nodo disparador elegido en lugar de un lienzo vacío.
      const { error } = await createClient().from("workflows").insert({
        ...input,
        tenant_id: requireTenant(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: "Draft",
        canvas_definition: seedTriggerCanvas(input.trigger_type, crypto.randomUUID()),
      });
      if (error) throw new Error(error.message);
    }),
    createWorkflowTemplate: (variant) => runMutation(async () => {
      const tenant = requireTenant();
      const isWelcome = variant === "bienvenida";
      const stage = data.pipelineStages.find((item) => item.tenant_id === tenant && item.name === "Interesado" && item.stage_category === "open")
        ?? data.pipelineStages.find((item) => item.tenant_id === tenant && item.stage_category === "open");
      const templateName = data.whatsappTemplates.find((item) => item.tenant_id === tenant && item.status === "APPROVED")?.name ?? null;
      const canvas = isWelcome
        ? buildWelcomeTemplateCanvas({ triggerType: "contact_created", templateName, stageId: stage?.id ?? null, stageName: stage?.name ?? "Interesado" })
        : buildRoundRobinTemplateCanvas("channel_message_received");
      const { error } = await createClient().from("workflows").insert({
        tenant_id: tenant,
        name: isWelcome ? "Bienvenida automática de formulario + Aviso de asesor" : "Reparto equitativo entre agentes activos (Round Robin)",
        description: isWelcome
          ? "Disparador: Contacto creado / Formulario Web → Enviar plantilla de bienvenida por WhatsApp → Mover a Interesado → Asignar Round Robin."
          : "Disparador: Mensaje recibido en WhatsApp → Marcar en seguimiento → Asignar equitativamente entre agentes activos.",
        status: "Draft",
        trigger_type: isWelcome ? "contact_created" : "channel_message_received",
        allow_reenrollment: false,
        canvas_definition: canvas,
        enrolled_count: 0,
        active_count: 0,
      });
      if (error) throw new Error(error.message);
    }),
    toggleWorkflowStatus: (workflowId) => runMutation(async () => {
      const workflow = data.workflows.find((item) => item.id === workflowId);
      if (!workflow) return;
      const { error } = await createClient().from("workflows").update({ status: workflow.status === "Published" ? "Draft" : "Published" }).eq("id", workflowId);
      if (error) throw new Error(error.message);
    }),
    deleteWorkflow: (workflowId) => runMutation(async () => {
      const { error } = await createClient().from("workflows").delete().eq("id", workflowId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    updateWorkflow: (workflowId, input) => runMutation(async () => {
      const { error } = await createClient().from("workflows").update(input).eq("id", workflowId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    updateWorkflowNodeConfig: (workflowId, nodeId, config) => runMutation(async () => {
      const workflow = data.workflows.find((item) => item.id === workflowId);
      if (!workflow) return;
      const canvas = { ...workflow.canvas_definition, nodes: workflow.canvas_definition.nodes.map((node) => node.id === nodeId ? { ...node, config: { ...node.config, ...config } } : node) };
      const { error } = await createClient().from("workflows").update({ canvas_definition: canvas }).eq("id", workflowId);
      if (error) throw new Error(error.message);
    }),
    addWorkflowActionNode: (workflowId, sourceNodeId, input) => runMutation(async () => {
      const workflow = data.workflows.find((item) => item.id === workflowId);
      const source = workflow?.canvas_definition.nodes.find((node) => node.id === sourceNodeId);
      if (!workflow || !source) return;
      const nodeId = crypto.randomUUID();
      const node = { id: nodeId, type: "action" as const, label: input.label.trim(), config: input.config, position: { x: source.position.x, y: source.position.y + 150 } };
      const edgeLabel = input.edgeLabel ?? null;
      const previousEdge = workflow.canvas_definition.edges.find((edge) => edge.source_node_id === sourceNodeId && edge.label === edgeLabel);
      const edges = workflow.canvas_definition.edges.filter((edge) => edge.id !== previousEdge?.id);
      edges.push({ id: crypto.randomUUID(), source_node_id: sourceNodeId, target_node_id: nodeId, label: previousEdge?.label ?? edgeLabel });
      if (previousEdge) edges.push({ id: crypto.randomUUID(), source_node_id: nodeId, target_node_id: previousEdge.target_node_id, label: null });
      const canvas = { nodes: [...workflow.canvas_definition.nodes, node], edges };
      const { error } = await createClient().from("workflows").update({ canvas_definition: canvas }).eq("id", workflowId);
      if (error) throw new Error(error.message);
    }),
    addWorkflowInitialNode: (workflowId, input) => runMutation(async () => {
      // QA-001: permite crear el primer nodo de un workflow heredado con lienzo vacío.
      const workflow = data.workflows.find((item) => item.id === workflowId);
      if (!workflow || workflow.canvas_definition.nodes.length > 0) return;
      const canvas = {
        nodes: [{ id: crypto.randomUUID(), type: input.type ?? "trigger" as const, label: input.label.trim(), config: input.config, position: { x: 0, y: 0 } }],
        edges: [],
      };
      const { error } = await createClient().from("workflows").update({ canvas_definition: canvas }).eq("id", workflowId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    enrollContactInWorkflow: (workflowId, contactId, _simulatedReply) => runMutation(async () => {
      const { error } = await createClient().from("workflow_enrollments").insert({ tenant_id: requireTenant(), workflow_id: workflowId, contact_id: contactId, status: "active", execution_logs: [{ node_id: "enrollment", node_label: "Inscripción manual", executed_at: new Date().toISOString(), outcome: "success", detail: "Contacto inscrito. La ejecución se procesará en el servidor." }] });
      if (error) throw new Error(error.message);
    }),
    inviteMember: (email, role) => runMutationAsync(async () => {
      // QA-002: propaga el resultado real al llamador (éxito 2xx o error 4xx/5xx).
      const response = await fetch("/api/v1/team/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: requireTenant(), email, role }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar la invitación.");
    }),
    updateMember: (memberId, patch) => runMutation(async () => {
      const { error } = await createClient().from("tenant_members").update(patch).eq("id", memberId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    deleteMember: (memberId) => runMutation(async () => {
      const { error } = await createClient().from("tenant_members").delete().eq("id", memberId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    createAiBot: (input) => runMutation(async () => {
      const { error } = await createClient().from("ai_bots").insert({
        ...input, tenant_id: requireTenant(), name: input.name.trim(), product_line: input.product_line.trim(),
        model_name: input.model_name?.trim() || null,
        fallback_models: input.fallback_models ?? [],
        priority: input.priority ?? 10,
        bot_role: input.bot_role ?? "custom",
        trigger_keywords: input.trigger_keywords ?? [],
      });
      if (error) throw new Error(error.message);
    }),
    toggleAiBot: (botId) => runMutation(async () => {
      const bot = data.aiBots.find((item) => item.id === botId);
      if (!bot) return;
      const { error } = await createClient().from("ai_bots").update({ is_active: !bot.is_active }).eq("id", botId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    // QA-004: borrado real vía RLS, filtrando estrictamente por tenant.
    deleteAiBot: (botId) => runMutation(async () => {
      const { error } = await createClient().from("ai_bots").delete().eq("id", botId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    updateAiBot: (botId, input) => runMutation(async () => {
      const { error } = await createClient().from("ai_bots").update({
        name: input.name.trim(),
        product_line: input.product_line.trim(),
        provider: input.provider,
        system_prompt: input.system_prompt,
        model_name: input.model_name?.trim() || null,
        fallback_models: input.fallback_models ?? [],
        priority: input.priority ?? 10,
        bot_role: input.bot_role ?? "custom",
        trigger_keywords: input.trigger_keywords ?? [],
      }).eq("id", botId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    // Fase 2 — modo Bot por defecto para contactos nuevos del workspace.
    updateTenantBotDefault: (patch: { default_new_contact_mode?: "bot" | "human"; default_bot_id?: string | null }) => runMutation(async () => {
      const { error } = await createClient().from("tenants").update(patch).eq("id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    setIntegrationConnected,
    addCustomField: (input) => runMutation(async () => {
      const { error } = await createClient().from("custom_field_definitions").insert({ ...input, tenant_id: requireTenant(), options: input.options ?? [] });
      if (error) throw new Error(error.message);
    }),
    updateCustomField: (fieldId, input) => runMutation(async () => {
      const { error } = await createClient().from("custom_field_definitions").update({ ...input, options: input.options ?? [] })
        .eq("id", fieldId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    deleteCustomField: (fieldId) => runMutation(async () => {
      const { error } = await createClient().from("custom_field_definitions").delete().eq("id", fieldId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
    addCustomValue: (valueKey, valueContent) => runMutation(async () => {
      const { error } = await createClient().from("custom_values").insert({ tenant_id: requireTenant(), value_key: valueKey.trim(), value_content: valueContent.trim() });
      if (error) throw new Error(error.message);
    }),
    deleteCustomValue: (valueId) => runMutation(async () => {
      const { error } = await createClient().from("custom_values").delete().eq("id", valueId).eq("tenant_id", requireTenant());
      if (error) throw new Error(error.message);
    }),
  }), [
    activeMember, activeTenant, contactQuery, contactTotal, dashboardStats, data, dataError,
    importContacts, isHydrated, isLoadingData, isMutating, isPlatformSuperadmin, login, logout, monthlyPerformance,
    pipelineStages, pipelineSummary, refreshData, register, requireTenant, runMutation, runMutationAsync, session, setContactQuery,
    setIntegrationConnected, setViewingAsMemberId, switchTenant, tenants, updateActiveTenantBranding, userAccounts, viewingAsMemberId, visibleMessages,
  ]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const context = useContext(CrmContext);
  if (!context) throw new Error("useCrm debe usarse dentro de <CrmProvider>.");
  return context;
}
