/**
 * MOCK — Oportunidades del tablero Kanban (planes de portabilidad $23.000 / $38.000).
 * Los planes comerciales del negocio: 50GB + llamadas ilimitadas.
 */

import type { Opportunity } from "@/shared/types/database";

export const mockOpportunities: Opportunity[] = [
  /* ================= Movistar Juancho — abiertas ================= */
  {
    id: "o-mj-001", tenant_id: "t-movistar-juancho", contact_id: "c-mj-001", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-interesado", assigned_member_id: "m-mj-sara",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:05:00-05:00", updated_at: "2026-11-12T14:17:00-05:00",
  },
  {
    id: "o-mj-002", tenant_id: "t-movistar-juancho", contact_id: "c-mj-002", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-interesado", assigned_member_id: "m-mj-carlos",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:10:00-05:00", updated_at: "2026-11-12T13:02:00-05:00",
  },
  {
    id: "o-mj-003", tenant_id: "t-movistar-juancho", contact_id: "c-mj-003", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-nuevo", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:12:00-05:00", updated_at: "2026-11-12T14:41:00-05:00",
  },
  {
    id: "o-mj-004", tenant_id: "t-movistar-juancho", contact_id: "c-mj-005", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-nip", assigned_member_id: "m-mj-diana",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:15:00-05:00", updated_at: "2026-11-12T11:48:00-05:00",
  },
  {
    id: "o-mj-005", tenant_id: "t-movistar-juancho", contact_id: "c-mj-006", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-nuevo", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:18:00-05:00", updated_at: "2026-11-12T14:55:00-05:00",
  },
  {
    id: "o-mj-006", tenant_id: "t-movistar-juancho", contact_id: "c-mj-008", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-nip", assigned_member_id: "m-mj-sara",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-06T08:20:00-05:00", updated_at: "2026-11-12T09:36:00-05:00",
  },
  {
    id: "o-mj-007", tenant_id: "t-movistar-juancho", contact_id: "c-mj-009", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-interesado", assigned_member_id: "m-mj-diana",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-07T10:20:00-05:00", updated_at: "2026-11-12T12:20:00-05:00",
  },
  {
    id: "o-mj-008", tenant_id: "t-movistar-juancho", contact_id: "c-mj-010", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-nuevo", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-07T11:45:00-05:00", updated_at: "2026-11-12T14:12:00-05:00",
  },
  {
    id: "o-mj-009", tenant_id: "t-movistar-juancho", contact_id: "c-mj-011", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-contactado", assigned_member_id: "m-mj-carlos",
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-07T14:25:00-05:00", updated_at: "2026-11-12T10:05:00-05:00",
  },
  {
    id: "o-mj-010", tenant_id: "t-movistar-juancho", contact_id: "c-mj-012", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-interesado", assigned_member_id: "m-mj-sara",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-08T09:10:00-05:00", updated_at: "2026-11-11T20:14:00-05:00",
  },
  /* ================= Movistar Juancho — cerradas (historial mensual) ================= */
  {
    id: "o-mj-101", tenant_id: "t-movistar-juancho", contact_id: "c-mj-013", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-ganado", assigned_member_id: "m-mj-sara",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "won", closed_at: "2026-10-30T15:40:00-05:00",
    created_at: "2026-10-12T10:05:00-05:00", updated_at: "2026-10-30T15:40:00-05:00",
  },
  {
    id: "o-mj-102", tenant_id: "t-movistar-juancho", contact_id: "c-mj-014", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-ganado", assigned_member_id: "m-mj-carlos",
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "won", closed_at: "2026-10-28T12:10:00-05:00",
    created_at: "2026-10-05T08:35:00-05:00", updated_at: "2026-10-28T12:10:00-05:00",
  },
  {
    id: "o-mj-103", tenant_id: "t-movistar-juancho", contact_id: "c-mj-015", pipeline_id: "p-mj-principal",
    stage_id: "st-mj-perdido", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "lost", closed_at: "2026-10-21T17:55:00-05:00",
    created_at: "2026-10-02T13:25:00-05:00", updated_at: "2026-10-21T17:55:00-05:00",
  },

  /* ================= Cuenta ================= */
  {
    id: "o-c-001", tenant_id: "t-cuenta", contact_id: "c-c-002", pipeline_id: "p-cuenta-principal",
    stage_id: "st-c-interesado", assigned_member_id: "m-cuenta-owner",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-01T09:05:00-05:00", updated_at: "2026-11-12T08:15:00-05:00",
  },
  {
    id: "o-c-002", tenant_id: "t-cuenta", contact_id: "c-c-003", pipeline_id: "p-cuenta-principal",
    stage_id: "st-c-nuevo", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-09T16:15:00-05:00", updated_at: "2026-11-11T19:40:00-05:00",
  },
  {
    id: "o-c-101", tenant_id: "t-cuenta", contact_id: "c-c-001", pipeline_id: "p-cuenta-principal",
    stage_id: "st-c-ganado", assigned_member_id: "m-cuenta-owner",
    title: "Plan Empresarial 4 líneas", monetary_value: 152000, status: "won", closed_at: "2026-10-30T10:00:00-05:00",
    created_at: "2026-10-20T11:00:00-05:00", updated_at: "2026-10-30T10:00:00-05:00",
  },

  /* ================= Movistar Juancho v2 ================= */
  {
    id: "o-v2-001", tenant_id: "t-movistar-juancho-v2", contact_id: "c-v2-002", pipeline_id: "p-mjv2-principal",
    stage_id: "st-v2-interesado", assigned_member_id: "m-mjv2-jorge",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "open", closed_at: null,
    created_at: "2026-11-06T07:35:00-05:00", updated_at: "2026-11-12T13:50:00-05:00",
  },
  {
    id: "o-v2-002", tenant_id: "t-movistar-juancho-v2", contact_id: "c-v2-003", pipeline_id: "p-mjv2-principal",
    stage_id: "st-v2-nuevo", assigned_member_id: null,
    title: "Plan 30GB + 300 minutos", monetary_value: 23000, status: "open", closed_at: null,
    created_at: "2026-11-06T09:25:00-05:00", updated_at: "2026-11-12T14:48:00-05:00",
  },
  {
    id: "o-v2-003", tenant_id: "t-movistar-juancho-v2", contact_id: "c-v2-001", pipeline_id: "p-mjv2-principal",
    stage_id: "st-v2-perdido", assigned_member_id: "m-mjv2-laura",
    title: "Plan 50GB + llamadas ilimitadas", monetary_value: 38000, status: "lost", closed_at: "2026-11-11T15:30:00-05:00",
    created_at: "2026-11-03T08:50:00-05:00", updated_at: "2026-11-11T15:30:00-05:00",
  },
];
