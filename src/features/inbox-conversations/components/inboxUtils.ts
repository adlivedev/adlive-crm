/**
 * M5 — Utilidades puras de la Bandeja Unificada de Conversaciones.
 * Filtros, previsualizaciones y constantes de tipificación (Skill 4: reutilización).
 */

import type { Contact, Conversation, ConversationWithDetails, WhatsAppTemplate } from "@/shared/types/database";

/** Regla de Meta Cloud API: sesión de atención de 24 h desde el último mensaje entrante. */
export const META_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Tipificaciones canónicas del Call Center de portabilidad. */
export const TYPIFICATION_OPTIONS = [
  "Seguimiento",
  "Cliente cerrado",
  "Cliente perdido",
  "Ya tiene Movistar",
  "No le interesa",
  "Equivocado",
] as const;

/** Píldoras de tipificación del sidebar (incluye códigos operativos POR y Fecha). */
export const TYPIFICATION_PILLS = [
  "Cliente cerrado",
  "Cliente perdido",
  "Ya tiene Movistar",
  "No le interesa",
  "Equivocado",
  "POR",
  "Fecha",
] as const;

/** Filtros de la primera fila del sidebar. */
export type InboxModeFilter = "all" | "bot" | "human" | "unread" | "starred" | "untyped";

export const MODE_FILTER_LABELS: Record<InboxModeFilter, string> = {
  all: "Todas",
  bot: "Bot",
  human: "Humano",
  unread: "Sin leer",
  starred: "⭐ Seguimiento",
  untyped: "Sin tipificar",
};

export interface InboxFilter {
  search: string;
  mode: InboxModeFilter;
  /** Tipificación exacta del contacto (píldora activa) o null. */
  typification: string | null;
  /** "all" | "unassigned" | memberId concreto. */
  assignee: string;
}

export const EMPTY_INBOX_FILTER: InboxFilter = { search: "", mode: "all", typification: null, assignee: "all" };

/** Texto plano sin tildes ni mayúsculas para búsquedas tolerantes. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Previsualización del último mensaje según su tipo multimedia. */
export function previewFor(conversation: Conversation): string {
  switch (conversation.last_message_media_type) {
    case "image":
      return "📷 Imagen";
    case "audio":
      return "🎙️ Nota de voz";
    case "video":
      return "🎬 Video";
    case "document":
      return "📄 Documento";
    default:
      return conversation.last_message_preview ?? "—";
  }
}

/** Aplica buscador + filtros de modo, tipificación y asignación sobre los hilos. */
export function matchesInboxFilters(
  thread: ConversationWithDetails,
  contact: Contact | undefined,
  filter: InboxFilter,
): boolean {
  const search = normalizeText(filter.search.trim());
  if (search) {
    const assignedEmail = normalizeText(thread.assigned_member_email ?? "");
    const haystack = normalizeText(
      `${thread.contact_name} ${thread.contact_phone} ${assignedEmail} ${thread.last_message_preview ?? ""}`,
    );
    if (!haystack.includes(search)) return false;
  }
  switch (filter.mode) {
    case "bot":
      if (thread.handler_mode !== "bot") return false;
      break;
    case "human":
      if (thread.handler_mode !== "human") return false;
      break;
    case "unread":
      if (thread.unread_count === 0) return false;
      break;
    case "starred":
      if (!contact?.is_starred) return false;
      break;
    case "untyped":
      if (contact?.typification) return false;
      break;
    default:
      break;
  }
  if (filter.typification && contact?.typification !== filter.typification) return false;
  if (filter.assignee === "unassigned" && thread.assigned_member_id) return false;
  if (filter.assignee !== "all" && filter.assignee !== "unassigned" && thread.assigned_member_id !== filter.assignee) {
    return false;
  }
  return true;
}

/** Reemplaza las variables {{1}}, {{2}}… con datos del contacto (misma regla que la ficha 360°). */
export function fillTemplateBody(template: WhatsAppTemplate, contact: Contact): string {
  const firstName = contact.full_name.trim().split(/\s+/)[0] ?? contact.full_name;
  return template.body_text
    .replaceAll("{{1}}", firstName)
    .replaceAll("{{2}}", "$38.000")
    .replaceAll("{{3}}", "50GB + llamadas ilimitadas");
}

/** Respuestas rápidas predefinidas del equipo de portabilidad. */
export const QUICK_REPLIES = [
  "Para la portabilidad necesitamos tu cédula, el operador actual y el NIP de 4 dígitos. ¿Me los compartes? 💜",
  "El plan de 50GB + llamadas ilimitadas queda en $38.000/mes con línea nueva incluida.",
  "El NIP lo solicitas marcando *264 desde tu línea actual; llega por SMS en minutos.",
  "La SIM nueva llega en 2–3 días hábiles al domicilio que nos indiques. 📦",
] as const;

/** Mensajes que simula el botón de prueba de recepción en tiempo real. */
export const SIMULATED_INBOUND_MESSAGES = [
  "Sí, me interesa el plan de 50GB. ¿Cómo empezamos con la portabilidad?",
  "Buenas, ¿sigue disponible la oferta de $38.000 con llamadas ilimitadas?",
  "Claro, te envío la cédula y el NIP por aquí mismo.",
  "Perfecto, ¿para cuándo me llegaría la SIM nueva?",
] as const;

/** ¿La ventana de 24 h de Meta sigue abierta para esta conversación? */
export function isMetaWindowOpen(conversation: Conversation, now: Date): boolean {
  if (!conversation.last_inbound_at) return false;
  return now.getTime() - new Date(conversation.last_inbound_at).getTime() < META_WINDOW_MS;
}
