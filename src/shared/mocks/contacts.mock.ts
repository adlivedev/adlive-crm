/**
 * MOCK — Contactos de portabilidad móvil, notas, tareas e historial de actividad.
 * Lote vigente de captación Meta Ads: etiqueta `06112026v4`, fuente WhatsApp.
 */

import type { Contact, ContactActivity, ContactNote, ContactTask } from "@/shared/types/database";

/** Atribución UTM compartida por el lote de pauta Meta (Portabilidad 50GB Nov 2026). */
const UTM_META = {
  utm_source: "facebook",
  utm_medium: "paid",
  utm_campaign: "Portabilidad 50GB - Noviembre 2026",
  utm_content: "video_testimonial_30s",
  utm_term: "planes movistar 50gb",
  fbclid: "IwAR2Xf9mQ7vL3nBp0aZ8kD1sH4gJ6cV9bN2mK5rT7yU1iO3pA4sD5fG6hJ8kL0",
  landing_url: "https://adlive.co/lp/portabilidad-50gb",
  referrer_url: "https://www.facebook.com/",
} as const;

const NOV_06 = "2026-11-06T08:00:00-05:00";

/** Campos personalizados típicos del proceso de portabilidad. */
const PORTABILITY_FIELDS = {
  operador_actual: "Claro",
  cedula: "",
  nip: "",
  direccion_envio_sim: "",
} as const;

export const mockContacts: Contact[] = [
  /* ================= Movistar Juancho — lote 06112026v4 (06 nov 2026) ================= */
  {
    id: "c-mj-001", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "ARMANDO CARDENAS CAPERA", phone_e164: "573207949885", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T14:17:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T14:17:00-05:00",
  },
  {
    id: "c-mj-002", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-carlos",
    full_name: "LIZ ESTEFANY BUITRAGO HERNANDEZ", phone_e164: "573155925733", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Tigo" },
    is_closed_client: false, is_starred: true, typification: "Seguimiento", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T13:02:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T13:02:00-05:00",
  },
  {
    id: "c-mj-003", tenant_id: "t-movistar-juancho", assigned_member_id: null,
    full_name: "AMPARO DEL CARMEN RAMIREZ LOPEZ", phone_e164: "573219029446", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T14:41:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T14:41:00-05:00",
  },
  {
    id: "c-mj-004", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "DIEGO FERN SUAREZ", phone_e164: "573104047759", email: "diego.fern@gmail.com", company_name: "Ferretería Suárez",
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Movistar" },
    is_closed_client: false, is_starred: false, typification: "Ya tiene Movistar", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-11T18:25:00-05:00", created_at: NOV_06, updated_at: "2026-11-11T18:25:00-05:00",
  },
  {
    id: "c-mj-005", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-diana",
    full_name: "DAYRO MANUEL MUENTES SANDON", phone_e164: "573104922997", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, cedula: "1.045.223.876" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T11:48:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T11:48:00-05:00",
  },
  {
    id: "c-mj-006", tenant_id: "t-movistar-juancho", assigned_member_id: null,
    full_name: "LUCELY ROSAS", phone_e164: "573213016431", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T14:55:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T14:55:00-05:00",
  },
  {
    id: "c-mj-007", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-carlos",
    full_name: "DELSY PADILLA", phone_e164: "573053559021", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "WOM" },
    is_closed_client: false, is_starred: false, typification: "No le interesa", opt_out_marketing: true,
    ...UTM_META, last_interaction_at: "2026-11-10T16:03:00-05:00", created_at: NOV_06, updated_at: "2026-11-10T16:03:00-05:00",
  },
  {
    id: "c-mj-008", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "ALEX ENRIQUE GUERRERO REDONDO", phone_e164: "573206402687", email: "alex.guerrero@outlook.com", company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, nip: "4821" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T09:36:00-05:00", created_at: NOV_06, updated_at: "2026-11-12T09:36:00-05:00",
  },
  {
    id: "c-mj-009", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-diana",
    full_name: "MARIA CAMILA TORRES RINCON", phone_e164: "573114523987", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4", "plan-38k"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "ETB" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T12:20:00-05:00", created_at: "2026-11-07T10:15:00-05:00", updated_at: "2026-11-12T12:20:00-05:00",
  },
  {
    id: "c-mj-010", tenant_id: "t-movistar-juancho", assigned_member_id: null,
    full_name: "JHONATAN STIVEN PEREZ MORA", phone_e164: "573223344556", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T14:12:00-05:00", created_at: "2026-11-07T11:40:00-05:00", updated_at: "2026-11-12T14:12:00-05:00",
  },
  {
    id: "c-mj-011", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-carlos",
    full_name: "YURANY VANESSA OCHOA DIAZ", phone_e164: "573013456778", email: "yurany.ochoa@gmail.com", company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4", "plan-23k"], custom_fields: { ...PORTABILITY_FIELDS, cedula: "1.098.334.221" },
    is_closed_client: false, is_starred: true, typification: "Seguimiento", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T10:05:00-05:00", created_at: "2026-11-07T14:22:00-05:00", updated_at: "2026-11-12T10:05:00-05:00",
  },
  {
    id: "c-mj-012", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "OSCAR MAURICIO VELANDIA CASTRO", phone_e164: "573166778899", email: null, company_name: "Droguería Velandia",
    lead_source: "Referido", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Claro" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, utm_source: "referido", utm_medium: "organic", utm_campaign: null, utm_content: null, utm_term: null, fbclid: null,
    last_interaction_at: "2026-11-11T20:14:00-05:00", created_at: "2026-11-08T09:05:00-05:00", updated_at: "2026-11-11T20:14:00-05:00",
  },
  /* ================= Movistar Juancho — leads históricos con cierre ================= */
  {
    id: "c-mj-013", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "CARLOS ALBERTO NIÑO GARZON", phone_e164: "573207112233", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["cliente-cerrado"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Claro", cedula: "79.456.231", direccion_envio_sim: "Calle 45 #12-33, Bogotá" },
    is_closed_client: true, is_starred: false, typification: "Cliente cerrado", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-10-30T15:40:00-05:00", created_at: "2026-10-12T10:00:00-05:00", updated_at: "2026-10-30T15:40:00-05:00",
  },
  {
    id: "c-mj-014", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-carlos",
    full_name: "PATRICIA LOPEZ MENDOZA", phone_e164: "573112223334", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["cliente-cerrado"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Tigo", cedula: "52.887.410" },
    is_closed_client: true, is_starred: false, typification: "Cliente cerrado", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-10-28T12:10:00-05:00", created_at: "2026-10-05T08:30:00-05:00", updated_at: "2026-10-28T12:10:00-05:00",
  },
  {
    id: "c-mj-015", tenant_id: "t-movistar-juancho", assigned_member_id: null,
    full_name: "FERNANDO GAITAN SALAZAR", phone_e164: "573005556667", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["perdido"], custom_fields: { ...PORTABILITY_FIELDS },
    is_closed_client: false, is_starred: false, typification: "Cliente perdido", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-10-21T17:55:00-05:00", created_at: "2026-10-02T13:20:00-05:00", updated_at: "2026-10-21T17:55:00-05:00",
  },

  /* ================= Movistar Juancho — turno tarde 12 nov 2026 (Bandeja M5) ================= */
  {
    id: "c-mj-016", tenant_id: "t-movistar-juancho", assigned_member_id: null,
    full_name: "Enrique Lopez Castillo", phone_e164: "573209887766", email: "enrique.lc@gmail.com", company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4", "turno-tarde"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Claro" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T17:21:00-05:00", created_at: "2026-11-12T15:30:00-05:00", updated_at: "2026-11-12T17:21:00-05:00",
  },
  {
    id: "c-mj-017", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-mateo",
    full_name: "RAUL ARMANDO", phone_e164: "573112445599", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "Tigo" },
    is_closed_client: false, is_starred: false, typification: "POR", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T17:10:00-05:00", created_at: "2026-11-12T14:05:00-05:00", updated_at: "2026-11-12T17:10:00-05:00",
  },
  {
    id: "c-mj-018", tenant_id: "t-movistar-juancho", assigned_member_id: "m-mj-sara",
    full_name: "Yuliana Vélez", phone_e164: "573225566114", email: "yuliana.velez@hotmail.com", company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4", "plan-23k"], custom_fields: { ...PORTABILITY_FIELDS, operador_actual: "WOM" },
    is_closed_client: false, is_starred: true, typification: "Equivocado", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T16:44:00-05:00", created_at: "2026-11-11T19:15:00-05:00", updated_at: "2026-11-12T16:44:00-05:00",
  },

  /* ================= Cuenta (tenant dueño) ================= */
  {
    id: "c-c-001", tenant_id: "t-cuenta", assigned_member_id: "m-cuenta-owner",
    full_name: "JUAN DAVID HOYOS RAMIREZ", phone_e164: "573104567890", email: "juan.hoyos@example.com", company_name: "CIERTO",
    lead_source: "Referido", tags: ["equipo"], custom_fields: {},
    is_closed_client: true, is_starred: false, typification: "Cliente cerrado", opt_out_marketing: false,
    ...UTM_META, utm_source: "directo", utm_medium: "none", utm_campaign: null, utm_content: null, utm_term: null, fbclid: null,
    last_interaction_at: "2026-11-10T09:30:00-05:00", created_at: "2026-08-14T10:25:00-05:00", updated_at: "2026-11-10T09:30:00-05:00",
  },
  {
    id: "c-c-002", tenant_id: "t-cuenta", assigned_member_id: "m-cuenta-owner",
    full_name: "SOFIA MARCELA AGUILAR PAEZ", phone_e164: "573223344556", email: null, company_name: "Agencia Aurora",
    lead_source: "WhatsApp", tags: ["plan-38k"], custom_fields: { operador_actual: "Claro" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T08:15:00-05:00", created_at: "2026-11-01T09:00:00-05:00", updated_at: "2026-11-12T08:15:00-05:00",
  },
  {
    id: "c-c-003", tenant_id: "t-cuenta", assigned_member_id: null,
    full_name: "RICARDO ANDRES PEÑA OSPINA", phone_e164: "573113334445", email: null, company_name: null,
    lead_source: "Formulario Web", tags: ["plan-23k"], custom_fields: {},
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, utm_source: "google", utm_medium: "cpc", utm_campaign: "Portabilidad Search CO",
    last_interaction_at: "2026-11-11T19:40:00-05:00", created_at: "2026-11-09T16:10:00-05:00", updated_at: "2026-11-11T19:40:00-05:00",
  },

  /* ================= Movistar Juancho v2 ================= */
  {
    id: "c-v2-001", tenant_id: "t-movistar-juancho-v2", assigned_member_id: "m-mjv2-laura",
    full_name: "KELLY JOHANA MARTINEZ FLOREZ", phone_e164: "573205554443", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["plan-38k"], custom_fields: { operador_actual: "Movistar" },
    is_closed_client: false, is_starred: false, typification: "Ya tiene Movistar", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T11:25:00-05:00", created_at: "2026-11-03T08:45:00-05:00", updated_at: "2026-11-12T11:25:00-05:00",
  },
  {
    id: "c-v2-002", tenant_id: "t-movistar-juancho-v2", assigned_member_id: "m-mjv2-jorge",
    full_name: "BRAYAN ESTIVEN CHAPARRO CRUZ", phone_e164: "573168889990", email: null, company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { operador_actual: "Claro", cedula: "1.022.445.887" },
    is_closed_client: false, is_starred: true, typification: "Seguimiento", opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T13:50:00-05:00", created_at: "2026-11-06T07:30:00-05:00", updated_at: "2026-11-12T13:50:00-05:00",
  },
  {
    id: "c-v2-003", tenant_id: "t-movistar-juancho-v2", assigned_member_id: null,
    full_name: "NATALIA ANDREA CRUZ VARGAS", phone_e164: "573177776665", email: "natalia.cruz@gmail.com", company_name: null,
    lead_source: "WhatsApp", tags: ["06112026v4"], custom_fields: { operador_actual: "WOM" },
    is_closed_client: false, is_starred: false, typification: null, opt_out_marketing: false,
    ...UTM_META, last_interaction_at: "2026-11-12T14:48:00-05:00", created_at: "2026-11-06T09:20:00-05:00", updated_at: "2026-11-12T14:48:00-05:00",
  },
];

export const mockContactNotes: ContactNote[] = [
  {
    id: "n-mj-001", tenant_id: "t-movistar-juancho", contact_id: "c-mj-002", author_member_id: "m-mj-carlos",
    content: "Cliente pide que la llamemos después de las 6 pm. Interesada en el plan de $38.000 con 50GB.",
    created_at: "2026-11-11T18:30:00-05:00",
  },
  {
    id: "n-mj-002", tenant_id: "t-movistar-juancho", contact_id: "c-mj-008", author_member_id: "m-mj-sara",
    content: "NIP recibido por WhatsApp. Pendiente validación en sistema de portabilidad.",
    created_at: "2026-11-12T09:40:00-05:00",
  },
  {
    id: "n-mj-003", tenant_id: "t-movistar-juancho", contact_id: "c-mj-005", author_member_id: "m-mj-diana",
    content: "Envió foto de la cédula. Falta confirmar dirección de entrega de la SIM.",
    created_at: "2026-11-12T11:50:00-05:00",
  },
  {
    id: "n-c-001", tenant_id: "t-cuenta", contact_id: "c-c-002", author_member_id: "m-cuenta-owner",
    content: "Agencia Aurora: decidirán la compra de 4 líneas la próxima semana.",
    created_at: "2026-11-10T10:00:00-05:00",
  },
];

export const mockContactTasks: ContactTask[] = [
  {
    id: "t-mj-001", tenant_id: "t-movistar-juancho", contact_id: "c-mj-002", assigned_member_id: "m-mj-carlos",
    title: "Llamar a Liz Estefany para cerrar plan de $38.000", due_at: "2026-11-12T18:00:00-05:00", is_completed: false, created_at: "2026-11-11T18:32:00-05:00",
  },
  {
    id: "t-mj-002", tenant_id: "t-movistar-juancho", contact_id: "c-mj-008", assigned_member_id: "m-mj-sara",
    title: "Validar NIP 4821 en plataforma de portabilidad", due_at: "2026-11-12T16:00:00-05:00", is_completed: false, created_at: "2026-11-12T09:42:00-05:00",
  },
  {
    id: "t-mj-003", tenant_id: "t-movistar-juancho", contact_id: "c-mj-005", assigned_member_id: "m-mj-diana",
    title: "Confirmar dirección de envío de SIM con Dayro", due_at: "2026-11-13T10:00:00-05:00", is_completed: false, created_at: "2026-11-12T11:52:00-05:00",
  },
  {
    id: "t-c-001", tenant_id: "t-cuenta", contact_id: "c-c-002", assigned_member_id: "m-cuenta-owner",
    title: "Enviar cotización de 4 líneas a Agencia Aurora", due_at: "2026-11-14T12:00:00-05:00", is_completed: false, created_at: "2026-11-10T10:05:00-05:00",
  },
];

export const mockContactActivities: ContactActivity[] = [
  {
    id: "a-mj-001", tenant_id: "t-movistar-juancho", contact_id: "c-mj-001", actor_member_id: "m-mj-sara",
    activity_type: "stage_change", description: "Oportunidad movida de «Nuevo Lead» a «Interesado» tras respuesta positiva al template bienvenida_lead.",
    metadata: { from: "Nuevo Lead", to: "Interesado" }, created_at: "2026-11-12T14:17:00-05:00",
  },
  {
    id: "a-mj-002", tenant_id: "t-movistar-juancho", contact_id: "c-mj-008", actor_member_id: "m-mj-sara",
    activity_type: "note", description: "Se registró una nota interna sobre el NIP recibido.", metadata: {}, created_at: "2026-11-12T09:40:00-05:00",
  },
  {
    id: "a-mj-003", tenant_id: "t-movistar-juancho", contact_id: "c-mj-002", actor_member_id: "m-mj-carlos",
    activity_type: "assignment", description: "Conversación asignada a carlos.ruiz@adlive.co en reparto Round Robin.",
    metadata: { member: "carlos.ruiz@adlive.co" }, created_at: "2026-11-12T13:02:00-05:00",
  },
  {
    id: "a-c-001", tenant_id: "t-cuenta", contact_id: "c-c-003", actor_member_id: "m-cuenta-owner",
    activity_type: "creation", description: "Contacto creado desde formulario web con captura UTM (google / cpc).", metadata: {}, created_at: "2026-11-09T16:10:00-05:00",
  },
];
