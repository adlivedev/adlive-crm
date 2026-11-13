/**
 * MOCK — Bandeja omnicanal de Conversaciones (WhatsApp) y mensajes.
 * Regla Meta: ventana de 24 h medida desde `last_inbound_at`.
 */

import type { Conversation, Message } from "@/shared/types/database";

/** ISO de hace `minutes` minutos: permite mostrar «hace 4 min» en vivo al cargar. */
function agoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const mockConversations: Conversation[] = [
  {
    id: "cv-mj-001", tenant_id: "t-movistar-juancho", contact_id: "c-mj-006", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "human", unread_count: 2, needs_reply: true,
    last_inbound_at: "2026-11-12T14:55:00-05:00", last_message_at: "2026-11-12T14:55:00-05:00",
    last_message_preview: "Buenas, ¿el plan de 50GB incluye llamadas ilimitadas a fijos?",
    last_message_media_type: "text", created_at: "2026-11-06T08:20:00-05:00",
  },
  {
    id: "cv-mj-002", tenant_id: "t-movistar-juancho", contact_id: "c-mj-003", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "human", unread_count: 1, needs_reply: true,
    last_inbound_at: "2026-11-12T14:41:00-05:00", last_message_at: "2026-11-12T14:41:00-05:00",
    last_message_preview: "Me interesa la portabilidad, ¿qué documentos necesito?",
    last_message_media_type: "text", created_at: "2026-11-06T08:14:00-05:00",
  },
  {
    id: "cv-mj-003", tenant_id: "t-movistar-juancho", contact_id: "c-mj-010", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "human", unread_count: 1, needs_reply: true,
    last_inbound_at: "2026-11-12T14:12:00-05:00", last_message_at: "2026-11-12T14:12:00-05:00",
    last_message_preview: "Nota de voz (0:34)",
    last_message_media_type: "audio", created_at: "2026-11-07T11:50:00-05:00",
  },
  {
    id: "cv-mj-004", tenant_id: "t-movistar-juancho", contact_id: "c-mj-001", assigned_member_id: "m-mj-sara",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: "2026-11-12T14:10:00-05:00", last_message_at: "2026-11-12T14:17:00-05:00",
    last_message_preview: "Perfecto, quedo atenta a la llamada. ¡Gracias!",
    last_message_media_type: "text", created_at: "2026-11-06T08:06:00-05:00",
  },
  {
    id: "cv-mj-005", tenant_id: "t-movistar-juancho", contact_id: "c-mj-002", assigned_member_id: "m-mj-carlos",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: "2026-11-12T12:58:00-05:00", last_message_at: "2026-11-12T13:02:00-05:00",
    last_message_preview: "Sí, después de las 6 pm me pueden llamar.",
    last_message_media_type: "text", created_at: "2026-11-06T08:12:00-05:00",
  },
  {
    id: "cv-mj-006", tenant_id: "t-movistar-juancho", contact_id: "c-mj-008", assigned_member_id: "m-mj-sara",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: "2026-11-12T09:30:00-05:00", last_message_at: "2026-11-12T09:36:00-05:00",
    last_message_preview: "El NIP es 4821, quedo pendiente.",
    last_message_media_type: "text", created_at: "2026-11-06T08:22:00-05:00",
  },
  {
    id: "cv-mj-007", tenant_id: "t-movistar-juancho", contact_id: "c-mj-005", assigned_member_id: "m-mj-diana",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: "2026-11-12T11:40:00-05:00", last_message_at: "2026-11-12T11:48:00-05:00",
    last_message_preview: "Le envío la foto de la cédula por aquí.",
    last_message_media_type: "image", created_at: "2026-11-06T08:16:00-05:00",
  },
  {
    id: "cv-c-001", tenant_id: "t-cuenta", contact_id: "c-c-002", assigned_member_id: "m-cuenta-owner",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: "2026-11-12T08:05:00-05:00", last_message_at: "2026-11-12T08:15:00-05:00",
    last_message_preview: "Nos interesan las 4 líneas, ¿manejan descuento por volumen?",
    last_message_media_type: "text", created_at: "2026-11-01T09:02:00-05:00",
  },
  {
    id: "cv-v2-001", tenant_id: "t-movistar-juancho-v2", contact_id: "c-v2-003", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "human", unread_count: 1, needs_reply: true,
    last_inbound_at: "2026-11-12T14:48:00-05:00", last_message_at: "2026-11-12T14:48:00-05:00",
    last_message_preview: "Hola, vengo del anuncio de Facebook sobre el plan de $23.000.",
    last_message_media_type: "text", created_at: "2026-11-06T09:22:00-05:00",
  },
  /* ---- Turno tarde 12 nov 2026 (timpos relativos al cargar el mock) ---- */
  {
    id: "cv-mj-008", tenant_id: "t-movistar-juancho", contact_id: "c-mj-016", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "human", unread_count: 2, needs_reply: true,
    last_inbound_at: agoIso(4), last_message_at: agoIso(4),
    last_message_preview: "Hola, ¿qué requisitos pide Movistar para portar mi línea de Claro?",
    last_message_media_type: "text", created_at: agoIso(110),
  },
  {
    id: "cv-mj-009", tenant_id: "t-movistar-juancho", contact_id: "c-mj-017", assigned_member_id: "m-mj-mateo",
    channel: "whatsapp", handler_mode: "human", unread_count: 1, needs_reply: true,
    last_inbound_at: agoIso(15), last_message_at: agoIso(15),
    last_message_preview: "Captura del plan que me ofreció el operador actual",
    last_message_media_type: "image", created_at: agoIso(190),
  },
  {
    id: "cv-mj-010", tenant_id: "t-movistar-juancho", contact_id: "c-mj-018", assigned_member_id: "m-mj-sara",
    channel: "whatsapp", handler_mode: "human", unread_count: 0, needs_reply: false,
    last_inbound_at: agoIso(41), last_message_at: agoIso(39),
    last_message_preview: "Listo, quedamos entonces. ¡Gracias por la aclaración!",
    last_message_media_type: "text", created_at: "2026-11-11T19:20:00-05:00",
  },
  {
    id: "cv-mj-011", tenant_id: "t-movistar-juancho", contact_id: "c-mj-007", assigned_member_id: null,
    channel: "whatsapp", handler_mode: "bot", unread_count: 0, needs_reply: false,
    last_inbound_at: agoIso(1500), last_message_at: agoIso(1490),
    last_message_preview: "Gracias por tu mensaje. Si no deseas recibir más información, responde «No».",
    last_message_media_type: "text", created_at: "2026-11-10T16:00:00-05:00",
  },
];

export const mockMessages: Message[] = [
  /* ---- cv-mj-001 · Lucely Rosas — plan $23.000 (sin responder) ---- */
  {
    id: "ms-mj-001a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-001", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MzIxMzAxNjQzFQIAERgS...", direction: "outbound", msg_type: "template",
    body: "Hola 👋, gracias por tu interés en Movistar. Tenemos el plan de 30GB + 300 minutos por solo $23.000/mes. Si no quieres recibir más mensajes, responde No.",
    media_url: null, media_mime_type: null, template_name: "bienvenida_lead", status: "read", error_reason: null,
    created_at: "2026-11-06T08:25:00-05:00",
  },
  {
    id: "ms-mj-001b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-001", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MzIxMzAxNjQzFQIAERgT...", direction: "inbound", msg_type: "text",
    body: "Buenas, ¿el plan de 50GB incluye llamadas ilimitadas a fijos?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:55:00-05:00",
  },
  /* ---- cv-mj-002 · Amparo Ramírez — plan $38.000 (sin responder) ---- */
  {
    id: "ms-mj-002a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-002", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MjE5MDI5NDQ2FQIAERgU...", direction: "outbound", msg_type: "template",
    body: "Hola Amparo 🚀, portabilidad Movistar: 50GB + llamadas ilimitadas por $38.000/mes. ¿Te ayudamos a tramitarla hoy? Si no quieres recibir más mensajes, responde No.",
    media_url: null, media_mime_type: null, template_name: "bienvenida_lead", status: "delivered", error_reason: null,
    created_at: "2026-11-06T08:30:00-05:00",
  },
  {
    id: "ms-mj-002b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-002", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MjE5MDI5NDQ2FQIAERgV...", direction: "inbound", msg_type: "text",
    body: "Me interesa la portabilidad, ¿qué documentos necesito?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:41:00-05:00",
  },
  /* ---- cv-mj-003 · Jhonatan Pérez — nota de voz (sin responder) ---- */
  {
    id: "ms-mj-003a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-003", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MjIzMzQ0NTU2FQIAERgW...", direction: "inbound", msg_type: "audio",
    body: "Nota de voz (0:34)",
    media_url: "https://cdn.adlive-crm.mock/audio/ms-mj-003a.ogg", media_mime_type: "audio/ogg", template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:12:00-05:00",
  },
  /* ---- cv-mj-004 · Armando Cárdenas — plan $38.000 (gestionado) ---- */
  {
    id: "ms-mj-004a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-004", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MjA3OTQ5ODg1FQIAERgX...", direction: "inbound", msg_type: "text",
    body: "Vi el anuncio del plan de 50GB por $38.000, me gustaría más información.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:05:00-05:00",
  },
  {
    id: "ms-mj-004b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-004", sender_member_id: "m-mj-sara",
    wa_message_id: "wamid.HBgMMjU3MjA3OTQ5ODg1FQIAERgY...", direction: "outbound", msg_type: "text",
    body: "Hola Armando, con gusto 💜. Para tramitar la portabilidad solo necesitamos tu cédula, el operador actual y el NIP. ¿Me los compartes?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:17:00-05:00",
  },
  /* ---- cv-mj-005 · Liz Estefany — plan $38.000 (gestionado) ---- */
  {
    id: "ms-mj-005a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-005", sender_member_id: "m-mj-carlos",
    wa_message_id: "wamid.HBgMMjU3MTU1OTI1NzMzFQIAERgZ...", direction: "outbound", msg_type: "text",
    body: "Hola Liz, te llamamos para activar tu plan de 50GB a $38.000. ¿A qué hora te queda bien?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T13:00:00-05:00",
  },
  {
    id: "ms-mj-005b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-005", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MTU1OTI1NzMzFQIAERga...", direction: "inbound", msg_type: "text",
    body: "Sí, después de las 6 pm me pueden llamar.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T13:02:00-05:00",
  },
  /* ---- cv-mj-006 · Alex Guerrero — validación NIP ---- */
  {
    id: "ms-mj-006a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-006", sender_member_id: "m-mj-sara",
    wa_message_id: "wamid.HBgMMjU3MjA2NDAyNjg3FQIAERgb...", direction: "outbound", msg_type: "text",
    body: "Alex, para continuar con tu portabilidad necesitamos el NIP de 4 dígitos que te envía tu operador actual.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T09:32:00-05:00",
  },
  {
    id: "ms-mj-006b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-006", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MjA2NDAyNjg3FQIAERgc...", direction: "inbound", msg_type: "text",
    body: "El NIP es 4821, quedo pendiente.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T09:30:00-05:00",
  },
  /* ---- cv-c-001 · Agencia Aurora (Cuenta) ---- */
  {
    id: "ms-c-001a", tenant_id: "t-cuenta", conversation_id: "cv-c-001", sender_member_id: "m-cuenta-owner",
    wa_message_id: "wamid.HBgMMjU3MjIzMzQ0NTU2FQIAERgd...", direction: "outbound", msg_type: "text",
    body: "Hola Sofía, sí manejamos descuento por volumen desde 3 líneas. Te preparo la cotización de las 4.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T08:15:00-05:00",
  },
  /* ---- cv-v2-001 · Natalia Cruz (v2) ---- */
  {
    id: "ms-v2-001a", tenant_id: "t-movistar-juancho-v2", conversation_id: "cv-v2-001", sender_member_id: null,
    wa_message_id: "wamid.HBgMMjU3MTc3Nzc2NjY1FQIAERge...", direction: "inbound", msg_type: "text",
    body: "Hola, vengo del anuncio de Facebook sobre el plan de $23.000.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: "2026-11-12T14:48:00-05:00",
  },
  /* ---- cv-mj-008 · Enrique Lopez Castillo — sin asignar (nuevo) ---- */
  {
    id: "ms-mj-008a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-008", sender_member_id: null,
    wa_message_id: "wamid.mock.enrique.001", direction: "outbound", msg_type: "template",
    body: "Hola Enrique 👋, vamos a ahorrarte en tu plan móvil: portabilidad Movistar 30GB por $23.000/mes. Si no quieres recibir más mensajes, responde No.",
    media_url: null, media_mime_type: null, template_name: "bienvenida_lead", status: "read", error_reason: null,
    created_at: agoIso(108),
  },
  {
    id: "ms-mj-008b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-008", sender_member_id: null,
    wa_message_id: "wamid.mock.enrique.002", direction: "inbound", msg_type: "text",
    body: "Hola, ¿qué requisitos pide Movistar para portar mi línea de Claro?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(6),
  },
  {
    id: "ms-mj-008c", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-008", sender_member_id: null,
    wa_message_id: "wamid.mock.enrique.003", direction: "inbound", msg_type: "text",
    body: "También quisiera saber si conservo mi mismo número.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(4),
  },
  /* ---- cv-mj-009 · RAUL ARMANDO — asignado a matagui0807@gmail.com ---- */
  {
    id: "ms-mj-009a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-009", sender_member_id: "m-mj-mateo",
    wa_message_id: "wamid.mock.raul.001", direction: "outbound", msg_type: "text",
    body: "Hola RAUL, te saluda Mateo de Movistar. Vi que te interesa la portabilidad del plan de $38.000. ¿Ya tienes el NIP?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(22),
  },
  {
    id: "ms-mj-009b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-009", sender_member_id: null,
    wa_message_id: "wamid.mock.raul.002", direction: "inbound", msg_type: "image",
    body: "Captura del plan que me ofreció el operador actual",
    media_url: "https://cdn.adlive-crm.mock/img/ms-mj-009b.jpg", media_mime_type: "image/jpeg", template_name: null, status: "read", error_reason: null,
    created_at: agoIso(15),
  },
  /* ---- cv-mj-010 · Yuliana Vélez — gestionado (equivocado, en seguimiento) ---- */
  {
    id: "ms-mj-010a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-010", sender_member_id: null,
    wa_message_id: "wamid.mock.yuliana.001", direction: "inbound", msg_type: "text",
    body: "Buenas, este número era de mi hermano, ¿siguen vendiendo los planes?",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(41),
  },
  {
    id: "ms-mj-010b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-010", sender_member_id: "m-mj-sara",
    wa_message_id: "wamid.mock.yuliana.002", direction: "outbound", msg_type: "text",
    body: "¡Hola Yuliana! Sí, claro. Aunque el número esté a nombre de otra persona, puedes tramitar tu propia línea nueva con el plan de $23.000.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(40),
  },
  {
    id: "ms-mj-010c", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-010", sender_member_id: null,
    wa_message_id: "wamid.mock.yuliana.003", direction: "inbound", msg_type: "text",
    body: "Listo, quedamos entonces. ¡Gracias por la aclaración!",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(39),
  },
  /* ---- cv-mj-011 · Delsy Padilla — atendida por el bot ---- */
  {
    id: "ms-mj-011a", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-011", sender_member_id: null,
    wa_message_id: "wamid.mock.delsy.001", direction: "inbound", msg_type: "text",
    body: "No me interesa por ahora, gracias.",
    media_url: null, media_mime_type: null, template_name: null, status: "read", error_reason: null,
    created_at: agoIso(1500),
  },
  {
    id: "ms-mj-011b", tenant_id: "t-movistar-juancho", conversation_id: "cv-mj-011", sender_member_id: null,
    wa_message_id: "wamid.mock.delsy.002", direction: "outbound", msg_type: "text",
    body: "Gracias por tu mensaje. Si no deseas recibir más información, responde «No».",
    media_url: null, media_mime_type: null, template_name: "bot_autorespuesta", status: "read", error_reason: null,
    created_at: agoIso(1490),
  },
];
