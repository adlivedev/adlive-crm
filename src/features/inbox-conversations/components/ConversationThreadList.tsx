"use client";

/**
 * M5 — Lista de hilos de chat del sidebar (subcomponente de ConversationSidebar).
 * Cada fila: avatar con inicial, nombre, tiempo relativo, estrella de seguimiento,
 * badge «nuevo», previsualización, badge de canal/conexión, modo Bot/Humano
 * y chip del correo del asesor asignado.
 */

import { Star } from "lucide-react";

import { Badge } from "@/shared/components/ui/Badge";
import { formatRelativeTime, initials } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, ConversationWithDetails } from "@/shared/types/database";

import { previewFor } from "./inboxUtils";

interface ConversationThreadListProps {
  threads: ConversationWithDetails[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  contacts: Contact[];
}

export function ConversationThreadList({ threads, selectedId, onSelect, contacts }: ConversationThreadListProps) {
  const { toggleContactStar } = useCrm();
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

  if (threads.length === 0) {
    return (
      <p className="my-auto px-4 py-10 text-center text-sm text-adlive-text-muted">
        No hay conversaciones que coincidan con los filtros.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y divide-adlive-border overflow-y-auto" aria-label="Hilos de conversación">
      {threads.map((thread) => {
        const contact = contactById.get(thread.contact_id);
        const isSelected = thread.id === selectedId;
        const isStarred = contact?.is_starred ?? false;
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={isSelected ? "true" : undefined}
              className={`flex w-full cursor-pointer flex-col gap-1 px-3 py-3 text-left transition-colors ${
                isSelected ? "bg-adlive-primary-light/60" : "hover:bg-adlive-canvas-bg/70"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-adlive-primary/10 text-xs font-bold text-adlive-primary"
                >
                  {initials(thread.contact_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-adlive-text-main">{thread.contact_name}</span>
                    <span className="shrink-0 text-[11px] text-adlive-text-muted">{formatRelativeTime(thread.last_message_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone="success" className="px-1.5 py-0 text-[10px]" title="WhatsApp Conectado">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-adlive-success" aria-hidden />
                      WA Act
                    </Badge>
                    <Badge tone={thread.handler_mode === "bot" ? "cyan" : "neutral"} className="px-1.5 py-0 text-[10px]">
                      {thread.handler_mode === "bot" ? "Bot" : "Humano"}
                    </Badge>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (contact) toggleContactStar(contact.id);
                    }}
                    aria-pressed={isStarred}
                    aria-label={isStarred ? `Quitar ${thread.contact_name} de seguimiento` : `Marcar ${thread.contact_name} como seguimiento`}
                    className={`cursor-pointer rounded-full p-1 transition-colors ${
                      isStarred ? "text-amber-400 hover:text-amber-500" : "text-adlive-border hover:text-amber-400"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`} aria-hidden />
                  </button>
                  {thread.unread_count > 0 ? (
                    <span className="rounded-md bg-adlive-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                      nuevo{thread.unread_count > 1 ? ` ${thread.unread_count}` : ""}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="block truncate pl-11 text-xs text-adlive-text-muted">
                {previewFor(thread)}
              </span>
              {thread.assigned_member_email ? (
                <span className="block pl-11 text-[10px] font-medium text-adlive-text-muted/80">
                  👤 {thread.assigned_member_email}
                </span>
              ) : (
                <span className="block pl-11 text-[10px] font-medium text-adlive-warning">Sin asignar</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
