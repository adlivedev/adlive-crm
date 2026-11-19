/**
 * M5 — Utilidades puras de la Bandeja Unificada de Conversaciones.
 * Filtros, previsualizaciones y constantes de tipificación (Skill 4: reutilización).
 */

import type { Contact, Conversation, ConversationWithDetails } from "@/shared/types/database";

/** Regla de Meta Cloud API: sesión de atención de 24 h desde el último mensaje entrante. */
export const META_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Tipificaciones neutrales; cada workspace puede ampliarlas con campos personalizados. */
export const TYPIFICATION_OPTIONS = [
  "Seguimiento",
  "Cliente cerrado",
  "Cliente perdido",
  "No le interesa",
  "Contacto equivocado",
  "Sin respuesta",
] as const;

export const TYPIFICATION_PILLS = [
  "Cliente cerrado",
  "Cliente perdido",
  "No le interesa",
  "Contacto equivocado",
  "Sin respuesta",
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

export { fillTemplateBody, isMetaWindowOpen } from "@/shared/lib/whatsapp";

/** Respuestas rápidas neutrales, editables en una iteración posterior por workspace. */
export const QUICK_REPLIES = [
  "Gracias por escribirnos. ¿En qué podemos ayudarte?",
  "¿Podrías compartirnos más detalles para revisar tu solicitud?",
  "Un asesor revisará la información y te responderá por este mismo chat.",
] as const;
