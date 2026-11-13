/**
 * MOCK — Plantillas Meta, Workflows, Bots IA, Integraciones y campos personalizados.
 */

import type {
  AiBot,
  CustomFieldDefinition,
  CustomValue,
  TenantIntegrationVault,
  WhatsAppTemplate,
} from "@/shared/types/database";

export const mockWhatsappTemplates: WhatsAppTemplate[] = [
  /* ============ Plantillas sincronizadas desde la WABA conectada (Meta Cloud API) ============ */
  {
    id: "wt-mj-waba-010203c", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102001",
    name: "010203c", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "¡Hola! Somos ADLIVE SAS, aliados oficiales Movistar. Te acompañamos en tu portabilidad con el plan de 50GB + llamadas ilimitadas. Escríbenos y te lo gestionamos hoy mismo.",
    footer_text: "ADLIVE SAS · Portabilidad Movistar", buttons: [], variables_count: 0,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-10-02T09:12:00-05:00", updated_at: "2026-11-10T08:40:00-05:00",
  },
  {
    id: "wt-mj-waba-04102026", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102002",
    name: "04102026", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, tu línea Movistar está lista para activarse. Confirma tu dirección de entrega y recibe tu SIM en 24-48 horas hábiles.",
    footer_text: null, buttons: [], variables_count: 1,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-10-04T10:30:00-05:00", updated_at: "2026-11-09T11:05:00-05:00",
  },
  {
    id: "wt-mj-waba-05112026", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102003",
    name: "05112026", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "🔥 Últimos días: lleva el plan Movistar de 50GB + llamadas ilimitadas a precio especial de portabilidad. Cupos limitados de la semana.",
    footer_text: "Válido hasta agotar cupos", buttons: [], variables_count: 0,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-11-05T08:00:00-05:00", updated_at: "2026-11-11T15:20:00-05:00",
  },
  {
    id: "wt-mj-waba-14102026v1", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102004",
    name: "14102026v1", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, notamos que te interesó el plan de 50GB. ¿Tienes alguna duda? Te resolvemos todo por aquí en minutos.",
    footer_text: null, buttons: [], variables_count: 1,
    status: "DISABLED", rejection_reason: "NONE",
    created_at: "2026-10-14T14:00:00-05:00", updated_at: "2026-10-30T18:10:00-05:00",
  },
  {
    id: "wt-mj-waba-15102026v1", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102005",
    name: "15102026v1", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, tu portabilidad avanza muy bien. Solo falta el NIP de 4 dígitos que llega por SMS desde tu operador actual. Compártelo y terminamos hoy.",
    footer_text: "ADLIVE SAS · Portabilidad Movistar", buttons: [], variables_count: 1,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-10-15T09:45:00-05:00", updated_at: "2026-11-08T09:30:00-05:00",
  },
  {
    id: "wt-mj-waba-15102026v2", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102006",
    name: "15102026v2", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "¡Felicidades! Tu portabilidad fue aprobada. En las próximas horas tu línea quedará activa con los 50GB + llamadas ilimitadas. Gracias por confiar en nosotros.",
    footer_text: null, buttons: [{ type: "QUICK_REPLY", text: "¡Gracias!" }], variables_count: 0,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-10-15T10:20:00-05:00", updated_at: "2026-11-06T16:45:00-05:00",
  },
  {
    id: "wt-mj-waba-15102026v3", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102007",
    name: "15102026v3", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, tu SIM ya está en camino. Cuando llegue, sigue las instrucciones del paquete o escríbenos y te ayudamos a activarla paso a paso.",
    footer_text: null, buttons: [], variables_count: 1,
    status: "DISABLED", rejection_reason: "NONE",
    created_at: "2026-10-15T11:05:00-05:00", updated_at: "2026-10-25T12:00:00-05:00",
  },
  {
    id: "wt-mj-waba-15102026v4", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102008",
    name: "15102026v4", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, ¿sigues interesado en el plan de 50GB + llamadas ilimitadas? Tenemos un cupo reservado para ti hasta mañana. Responde SI y lo activamos hoy.",
    footer_text: "Cupo sujeto a validación de portabilidad", buttons: [{ type: "QUICK_REPLY", text: "Sí" }, { type: "QUICK_REPLY", text: "No" }], variables_count: 1,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-10-15T12:30:00-05:00", updated_at: "2026-11-12T08:15:00-05:00",
  },
  /* ============ Plantillas de campañas del CRM ============ */
  {
    id: "wt-mj-001", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102555",
    name: "bienvenida_lead", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}} 👋, gracias por tu interés en Movistar. Tenemos el plan de 50GB + llamadas ilimitadas por solo {{2}}/mes. Si no quieres recibir más mensajes, responde No.",
    footer_text: "ADLIVE SAS · Portabilidad Movistar", buttons: [], variables_count: 2,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-05-10T10:00:00-05:00", updated_at: "2026-11-01T09:00:00-05:00",
  },
  {
    id: "wt-mj-002", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102556",
    name: "seguimiento_portabilidad", category: "UTILITY", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, tu portabilidad está casi lista. Envíanos tu cédula, operador actual y NIP para terminar el trámite hoy mismo.",
    footer_text: null, buttons: [], variables_count: 1,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-06-02T11:30:00-05:00", updated_at: "2026-10-12T08:00:00-05:00",
  },
  {
    id: "wt-mj-003", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102557",
    name: "confirmacion_datos_sim", category: "UTILITY", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Confirmamos la dirección de envío de tu SIM: {{1}}. La recibirás en 24-48 horas hábiles.",
    footer_text: null, buttons: [], variables_count: 1,
    status: "DISABLED", rejection_reason: "NONE",
    created_at: "2026-07-15T14:00:00-05:00", updated_at: "2026-10-28T16:00:00-05:00",
  },
  {
    id: "wt-mj-004", tenant_id: "t-movistar-juancho", meta_template_id: "1049283746102558",
    name: "promo_black_friday", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "🔥 Black Friday Movistar: el plan de 50GB baja a {{1}}/mes por 3 meses. Responde SI para apartar tu línea.",
    footer_text: "Válido hasta agotar existencias", buttons: [{ type: "QUICK_REPLY", text: "Sí, me interesa" }, { type: "QUICK_REPLY", text: "No" }], variables_count: 1,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-11-05T09:00:00-05:00", updated_at: "2026-11-08T10:00:00-05:00",
  },
  {
    id: "wt-c-001", tenant_id: "t-cuenta", meta_template_id: "2049283746102551",
    name: "bienvenida_agencia", category: "MARKETING", language: "es",
    header_type: "NONE", header_content: null,
    body_text: "Hola {{1}}, bienvenido a {{2}}. Cuéntanos cuántas líneas necesitas y te armamos la mejor oferta.",
    footer_text: null, buttons: [], variables_count: 2,
    status: "APPROVED", rejection_reason: "NONE",
    created_at: "2026-08-20T10:00:00-05:00", updated_at: "2026-11-02T09:00:00-05:00",
  },
];

export const mockAiBots: AiBot[] = [
  {
    id: "bot-mj-001", tenant_id: "t-movistar-juancho",
    name: "Asistente Portabilidad", product_line: "Planes móviles prepago",
    provider: "integrated",
    system_prompt: "Eres un asesor comercial de ADLIVE SAS especializado en portabilidad Movistar. Responde en español, pregunta por el operador actual y ofrece el plan de 50GB a $38.000.",
    is_active: true, created_at: "2026-06-01T10:00:00-05:00",
  },
  {
    id: "bot-mj-002", tenant_id: "t-movistar-juancho",
    name: "Calificador de leads 06112026v4", product_line: "Campaña Meta 50GB",
    provider: "integrated",
    system_prompt: "Califica leads del lote 06112026v4: confirma interés real, documentos disponibles y horario de llamada.",
    is_active: true, created_at: "2026-11-06T09:00:00-05:00",
  },
  {
    id: "bot-c-001", tenant_id: "t-cuenta",
    name: "Bot de ejemplo: Placita Express", product_line: "Ventas B2B",
    provider: "integrated",
    system_prompt: "Asistente de ventas B2B para cuentas empresariales de telecomunicaciones.",
    is_active: true, created_at: "2026-09-15T10:00:00-05:00",
  },
];

/**
 * Bóveda de integraciones. `encrypted_credentials` simula el payload cifrado
 * AES-256-GCM: en Etapa B viaja cifrado desde el servidor y jamás al navegador.
 */
export const mockIntegrationsVault: TenantIntegrationVault[] = [
  {
    id: "iv-mj-wa", tenant_id: "t-movistar-juancho", provider: "whatsapp_cloud_api",
    is_connected: true,
    public_metadata: { phone_number: "+57 320 794 9885", waba_id: "1049283746102555", display_name: "Movistar Juancho" },
    encrypted_credentials: "enc:v1:aes256gcm:9f4c2b8e1d7a4036c5e9b2d8f1a6c3e5",
    updated_at: "2026-11-01T10:00:00-05:00",
  },
  {
    id: "iv-mj-fb", tenant_id: "t-movistar-juancho", provider: "facebook_lead_ads",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-05-02T08:35:00-05:00",
  },
  {
    id: "iv-mj-ig", tenant_id: "t-movistar-juancho", provider: "instagram",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-05-02T08:35:05-05:00",
  },
  {
    id: "iv-mj-tt", tenant_id: "t-movistar-juancho", provider: "tiktok_ads",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-05-02T08:35:10-05:00",
  },
  {
    id: "iv-mj-tw", tenant_id: "t-movistar-juancho", provider: "twilio",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-05-02T08:35:15-05:00",
  },
  {
    id: "iv-mj-tx", tenant_id: "t-movistar-juancho", provider: "telnyx",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-05-02T08:35:20-05:00",
  },
  {
    id: "iv-c-wa", tenant_id: "t-cuenta", provider: "whatsapp_cloud_api",
    is_connected: false, public_metadata: {},
    encrypted_credentials: "enc:v1:aes256gcm:00000000000000000000000000000000",
    updated_at: "2026-08-14T10:30:00-05:00",
  },
];

export const mockCustomFieldDefinitions: CustomFieldDefinition[] = [
  {
    id: "cf-mj-001", tenant_id: "t-movistar-juancho", field_key: "operador_actual",
    field_label: "Operador actual", field_type: "select",
    options: ["Claro", "Movistar", "Tigo", "WOM", "ETB", "Virgin Mobile"],
    created_at: "2026-05-02T09:00:00-05:00",
  },
  {
    id: "cf-mj-002", tenant_id: "t-movistar-juancho", field_key: "cedula",
    field_label: "Cédula de ciudadanía", field_type: "text", options: [],
    created_at: "2026-05-02T09:01:00-05:00",
  },
  {
    id: "cf-mj-003", tenant_id: "t-movistar-juancho", field_key: "nip",
    field_label: "NIP de portabilidad", field_type: "text", options: [],
    created_at: "2026-05-02T09:02:00-05:00",
  },
  {
    id: "cf-mj-004", tenant_id: "t-movistar-juancho", field_key: "direccion_envio_sim",
    field_label: "Dirección de envío de la SIM", field_type: "text", options: [],
    created_at: "2026-05-02T09:03:00-05:00",
  },
  {
    id: "cf-mj-005", tenant_id: "t-movistar-juancho", field_key: "fecha_cita_llamada",
    field_label: "Fecha de cita de llamada", field_type: "date", options: [],
    created_at: "2026-06-10T10:00:00-05:00",
  },
  {
    id: "cf-c-001", tenant_id: "t-cuenta", field_key: "operador_actual",
    field_label: "Operador actual", field_type: "select",
    options: ["Claro", "Movistar", "Tigo", "WOM"],
    created_at: "2026-08-14T10:35:00-05:00",
  },
];

export const mockCustomValues: CustomValue[] = [
  {
    id: "cvv-mj-001", tenant_id: "t-movistar-juancho", value_key: "respuesta_precio",
    value_content: "El plan de 50GB + llamadas ilimitadas vale $38.000/mes y el de 30GB + 300 minutos vale $23.000/mes.",
    created_at: "2026-06-01T10:00:00-05:00",
  },
  {
    id: "cvv-mj-002", tenant_id: "t-movistar-juancho", value_key: "respuesta_documentos",
    value_content: "Para la portabilidad necesitamos: cédula, operador actual, NIP de 4 dígitos y dirección de envío de la SIM.",
    created_at: "2026-06-01T10:01:00-05:00",
  },
];
