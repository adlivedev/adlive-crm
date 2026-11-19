/**
 * MOCK — Multi-tenancy, equipo Call Center, pipelines y estadísticas base.
 * Etapa A (Frontend): fuente de verdad en memoria hasta la migración Supabase MCP.
 */

import type {
  Pipeline,
  PipelineStage,
  Tenant,
  TenantMember,
} from "@/shared/types/database";

/* Fechas de referencia del lote de captación vigente (etiqueta 06112026v4). */
const NOV_06 = "2026-11-06T08:00:00-05:00";

export const mockTenants: Tenant[] = [
  {
    id: "t-cuenta",
    name: "CIERTO",
    slug: "cierto",
    public_webhook_token: "whk_cuenta_9f2a41c8d7e64b03a5f18c92d6e04b71",
    branding: {
      brand_name: "CIERTO",
      logo_url: "/brands/cierto/CIERTO_Logo_Principal.png",
      logo_dark_url: "/brands/cierto/CIERTO_Logo_Principal.png",
      primary_color: "#6B07E9",
      primary_hover: "#4805AD",
      accent_color: "#FF573D",
      sidebar_bg: "#100D30",
      canvas_bg: "#F7F3FF",
      ink_color: "#100D30",
    },
    created_at: "2026-08-14T10:20:00-05:00",
    updated_at: "2026-11-10T09:00:00-05:00",
  },
  {
    id: "t-movistar-juancho",
    name: "MovisVendemos",
    slug: "movisvendemos",
    public_webhook_token: "whk_mj_4c81be02f7a549d3b6e08f1a93c5d27e",
    branding: {
      brand_name: "MovisVendemos",
      logo_url: null,
      logo_dark_url: null,
      primary_color: "#0066CC",
      primary_hover: "#004C99",
      accent_color: "#00A8A8",
      sidebar_bg: "#0B192C",
      canvas_bg: "#F0F6FC",
      ink_color: "#0B192C",
    },
    created_at: "2026-05-02T08:30:00-05:00",
    updated_at: "2026-11-12T07:45:00-05:00",
  },
  {
    id: "t-movistar-juancho-v2",
    name: "Workspace Demo",
    slug: "workspace-demo",
    public_webhook_token: "whk_mjv2_71d0c3a95e2b48f6a1c7d08e3b94f150",
    created_at: "2026-09-21T14:10:00-05:00",
    updated_at: "2026-11-11T18:22:00-05:00",
  },
];

/** Usuario que opera la sesión demo (dueño/admin de las 3 cuentas). */
export const MOCK_SESSION_EMAIL = "blue.juan.hoyos@gmail.com";

export const mockTenantMembers: TenantMember[] = [
  /* ---- Cuenta (dueño) ---- */
  {
    id: "m-cuenta-owner",
    tenant_id: "t-cuenta",
    user_id: "u-juan-hoyos",
    email: MOCK_SESSION_EMAIL,
    role: "owner",
    is_active: true,
    can_view_all_contacts: true,
    presence: "online",
    last_assigned_at: "2026-11-12T14:30:00-05:00",
    created_at: "2026-08-14T10:20:00-05:00",
  },

  /* ---- Movistar Juancho (admin + agentes call center) ---- */
  {
    id: "m-mj-admin",
    tenant_id: "t-movistar-juancho",
    user_id: "u-juan-hoyos",
    email: MOCK_SESSION_EMAIL,
    role: "admin",
    is_active: true,
    can_view_all_contacts: true,
    presence: "online",
    last_assigned_at: "2026-11-12T14:05:00-05:00",
    created_at: "2026-05-02T08:30:00-05:00",
  },
  {
    id: "m-mj-sara",
    tenant_id: "t-movistar-juancho",
    user_id: "u-sara-gomez",
    email: "sara.gomez@adlive.co",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "online",
    last_assigned_at: "2026-11-12T14:40:00-05:00",
    created_at: "2026-06-11T09:00:00-05:00",
  },
  {
    id: "m-mj-carlos",
    tenant_id: "t-movistar-juancho",
    user_id: "u-carlos-ruiz",
    email: "carlos.ruiz@adlive.co",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "busy",
    last_assigned_at: "2026-11-12T14:38:00-05:00",
    created_at: "2026-06-11T09:05:00-05:00",
  },
  {
    id: "m-mj-diana",
    tenant_id: "t-movistar-juancho",
    user_id: "u-diana-prada",
    email: "diana.prada@adlive.co",
    role: "agent",
    is_active: true,
    can_view_all_contacts: true,
    presence: "offline",
    last_assigned_at: "2026-11-11T19:12:00-05:00",
    created_at: "2026-07-03T11:30:00-05:00",
  },
  {
    id: "m-mj-mateo",
    tenant_id: "t-movistar-juancho",
    user_id: "u-mateo-guerra",
    email: "matagui0807@gmail.com",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "online",
    last_assigned_at: "2026-11-12T16:50:00-05:00",
    created_at: "2026-10-20T08:00:00-05:00",
  },
  {
    id: "m-mj-hector",
    tenant_id: "t-movistar-juancho",
    user_id: null,
    email: "heclo9307@gmail.com",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "online",
    last_assigned_at: "2026-11-12T15:10:00-05:00",
    created_at: "2026-10-02T09:20:00-05:00",
  },
  {
    id: "m-mj-vanesa",
    tenant_id: "t-movistar-juancho",
    user_id: null,
    email: "vanesanchez0802@gmail.com",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "offline",
    last_assigned_at: "2026-11-11T18:30:00-05:00",
    created_at: "2026-10-05T10:40:00-05:00",
  },
  {
    id: "m-mj-andres",
    tenant_id: "t-movistar-juancho",
    user_id: "u-andres-felipe",
    email: "andres.felipe@adlive.co",
    role: "agent",
    is_active: false,
    can_view_all_contacts: false,
    presence: "offline",
    last_assigned_at: "2026-10-28T16:44:00-05:00",
    created_at: "2026-08-19T15:45:00-05:00",
  },

  /* ---- Movistar Juancho v2 (admin + agentes) ---- */
  {
    id: "m-mjv2-admin",
    tenant_id: "t-movistar-juancho-v2",
    user_id: "u-juan-hoyos",
    email: MOCK_SESSION_EMAIL,
    role: "admin",
    is_active: true,
    can_view_all_contacts: true,
    presence: "online",
    last_assigned_at: "2026-11-12T13:55:00-05:00",
    created_at: "2026-09-21T14:10:00-05:00",
  },
  {
    id: "m-mjv2-laura",
    tenant_id: "t-movistar-juancho-v2",
    user_id: "u-laura-cifuentes",
    email: "laura.cifuentes@adlive.co",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "online",
    last_assigned_at: "2026-11-12T14:42:00-05:00",
    created_at: "2026-09-22T10:00:00-05:00",
  },
  {
    id: "m-mjv2-jorge",
    tenant_id: "t-movistar-juancho-v2",
    user_id: "u-jorge-molina",
    email: "jorge.molina@adlive.co",
    role: "agent",
    is_active: true,
    can_view_all_contacts: false,
    presence: "offline",
    last_assigned_at: "2026-11-10T17:20:00-05:00",
    created_at: "2026-09-22T10:05:00-05:00",
  },
];

export const mockPipelines: Pipeline[] = [
  {
    id: "p-mj-principal",
    tenant_id: "t-movistar-juancho",
    name: "Ventas Portabilidad",
    is_default: true,
    created_at: "2026-05-02T08:31:00-05:00",
  },
  {
    id: "p-cuenta-principal",
    tenant_id: "t-cuenta",
    name: "Pipeline Principal",
    is_default: true,
    created_at: "2026-08-14T10:21:00-05:00",
  },
  {
    id: "p-mjv2-principal",
    tenant_id: "t-movistar-juancho-v2",
    name: "Pipeline Principal",
    is_default: true,
    created_at: "2026-09-21T14:11:00-05:00",
  },
];

/** Etapas Kanban canónicas: Nuevo Lead → Contactado → Interesado → En Validación NIP → Ganado / Perdido. */
export const mockPipelineStages: PipelineStage[] = [
  /* Movistar Juancho */
  { id: "st-mj-nuevo", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "Nuevo Lead", position: 0, stage_category: "open", created_at: "2026-05-02T08:32:00-05:00" },
  { id: "st-mj-contactado", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "Contactado", position: 1, stage_category: "open", created_at: "2026-05-02T08:32:05-05:00" },
  { id: "st-mj-interesado", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "Interesado", position: 2, stage_category: "open", created_at: "2026-05-02T08:32:10-05:00" },
  { id: "st-mj-nip", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "En Validación NIP", position: 3, stage_category: "open", created_at: "2026-05-02T08:32:15-05:00" },
  { id: "st-mj-ganado", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "Ganado", position: 4, stage_category: "won", created_at: "2026-05-02T08:32:20-05:00" },
  { id: "st-mj-perdido", pipeline_id: "p-mj-principal", tenant_id: "t-movistar-juancho", name: "Perdido", position: 5, stage_category: "lost", created_at: "2026-05-02T08:32:25-05:00" },
  /* Cuenta */
  { id: "st-c-nuevo", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "Nuevo Lead", position: 0, stage_category: "open", created_at: "2026-08-14T10:22:00-05:00" },
  { id: "st-c-contactado", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "Contactado", position: 1, stage_category: "open", created_at: "2026-08-14T10:22:05-05:00" },
  { id: "st-c-interesado", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "Interesado", position: 2, stage_category: "open", created_at: "2026-08-14T10:22:10-05:00" },
  { id: "st-c-nip", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "En Validación NIP", position: 3, stage_category: "open", created_at: "2026-08-14T10:22:15-05:00" },
  { id: "st-c-ganado", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "Ganado", position: 4, stage_category: "won", created_at: "2026-08-14T10:22:20-05:00" },
  { id: "st-c-perdido", pipeline_id: "p-cuenta-principal", tenant_id: "t-cuenta", name: "Perdido", position: 5, stage_category: "lost", created_at: "2026-08-14T10:22:25-05:00" },
  /* Movistar Juancho v2 */
  { id: "st-v2-nuevo", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "Nuevo Lead", position: 0, stage_category: "open", created_at: "2026-09-21T14:12:00-05:00" },
  { id: "st-v2-contactado", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "Contactado", position: 1, stage_category: "open", created_at: "2026-09-21T14:12:05-05:00" },
  { id: "st-v2-interesado", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "Interesado", position: 2, stage_category: "open", created_at: "2026-09-21T14:12:10-05:00" },
  { id: "st-v2-nip", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "En Validación NIP", position: 3, stage_category: "open", created_at: "2026-09-21T14:12:15-05:00" },
  { id: "st-v2-ganado", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "Ganado", position: 4, stage_category: "won", created_at: "2026-09-21T14:12:20-05:00" },
  { id: "st-v2-perdido", pipeline_id: "p-mjv2-principal", tenant_id: "t-movistar-juancho-v2", name: "Perdido", position: 5, stage_category: "lost", created_at: "2026-09-21T14:12:25-05:00" },
];

/**
 * Estadísticas agregadas por tenant. En Etapa A los volúmenes reales
 * (24,077 contactos / 1,805 oportunidades) viven aquí como línea base;
 * el crmStore suma los deltas de las operaciones CRUD en vivo sobre esta base.
 */
export interface TenantStatsBase {
  total_contacts: number;
  open_opportunities: number;
  total_revenue: number;
  unanswered: number;
  /** Conteo de oportunidades abiertas por stage_id. */
  stage_counts: Record<string, number>;
  /** Rendimiento mensual de cierre: clave YYYY-MM. */
  monthly: Record<string, { ganadas: number; perdidas: number }>;
}

export const mockTenantStats: Record<string, TenantStatsBase> = {
  "t-cuenta": {
    total_contacts: 312,
    open_opportunities: 45,
    total_revenue: 1840000,
    unanswered: 2,
    stage_counts: {
      "st-c-nuevo": 18,
      "st-c-contactado": 6,
      "st-c-interesado": 14,
      "st-c-nip": 7,
    },
    monthly: {
      "2026-06": { ganadas: 9, perdidas: 22 },
      "2026-07": { ganadas: 14, perdidas: 19 },
      "2026-08": { ganadas: 21, perdidas: 25 },
      "2026-09": { ganadas: 18, perdidas: 17 },
      "2026-10": { ganadas: 26, perdidas: 31 },
      "2026-11": { ganadas: 6, perdidas: 4 },
    },
  },
  "t-movistar-juancho": {
    total_contacts: 24077,
    open_opportunities: 1805,
    total_revenue: 0,
    unanswered: 3,
    stage_counts: {
      "st-mj-nuevo": 697,
      "st-mj-contactado": 0,
      "st-mj-interesado": 716,
      "st-mj-nip": 392,
    },
    monthly: {
      "2026-06": { ganadas: 0, perdidas: 0 },
      "2026-07": { ganadas: 0, perdidas: 0 },
      "2026-08": { ganadas: 0, perdidas: 0 },
      "2026-09": { ganadas: 0, perdidas: 0 },
      "2026-10": { ganadas: 12, perdidas: 2800 },
      "2026-11": { ganadas: 3, perdidas: 41 },
    },
  },
  "t-movistar-juancho-v2": {
    total_contacts: 1840,
    open_opportunities: 96,
    total_revenue: 1610000,
    unanswered: 1,
    stage_counts: {
      "st-v2-nuevo": 38,
      "st-v2-contactado": 12,
      "st-v2-interesado": 29,
      "st-v2-nip": 17,
    },
    monthly: {
      "2026-06": { ganadas: 0, perdidas: 0 },
      "2026-07": { ganadas: 0, perdidas: 0 },
      "2026-08": { ganadas: 0, perdidas: 0 },
      "2026-09": { ganadas: 11, perdidas: 14 },
      "2026-10": { ganadas: 23, perdidas: 19 },
      "2026-11": { ganadas: 8, perdidas: 5 },
    },
  },
};

export { NOV_06 };
