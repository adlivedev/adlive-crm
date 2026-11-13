"use client";

/**
 * M5 — Vista orquestadora de la bandeja en 3 columnas.
 *
 * - Resuelve ConversationWithDetails (contacto + asesor) y aplica los filtros
 *   del sidebar con useMemo (sin re-render innecesarios — Skill 4).
 * - Mantiene la conversación activa; si se elimina, salta al primer hilo disponible.
 */

import { useEffect, useMemo, useState } from "react";

import { useCrm } from "@/shared/services/crmStore";
import type { ConversationWithDetails } from "@/shared/types/database";

import { ChatCanvas } from "./ChatCanvas";
import { ContactContextPanel } from "./ContactContextPanel";
import { ConversationSidebar } from "./ConversationSidebar";
import { EMPTY_INBOX_FILTER, matchesInboxFilters, type InboxFilter } from "./inboxUtils";

export function InboxView() {
  const { conversations, contacts, members } = useCrm();
  const [filter, setFilter] = useState<InboxFilter>(EMPTY_INBOX_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ---- Hilos resueltos: contacto + asesor, ordenados por actividad ---- */
  const threads = useMemo<ConversationWithDetails[]>(() => {
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    return conversations
      .map((conversation) => {
        const contact = contactById.get(conversation.contact_id);
        const assignee = conversation.assigned_member_id
          ? memberById.get(conversation.assigned_member_id)
          : undefined;
        return {
          ...conversation,
          contact_name: contact?.full_name ?? "Contacto eliminado",
          contact_phone: contact?.phone_e164 ?? "",
          contact_tags: contact?.tags ?? [],
          assigned_member_name: assignee?.email ?? null,
          assigned_member_email: assignee?.email ?? null,
        } satisfies ConversationWithDetails;
      })
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  }, [conversations, contacts, members]);

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);

  const filteredThreads = useMemo(
    () =>
      threads.filter((thread) =>
        matchesInboxFilters(thread, contactById.get(thread.contact_id), filter),
      ),
    [threads, contactById, filter],
  );

  /* ---- Conversación activa con resguardo ante eliminación ---- */
  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedThread && threads.length > 0) setSelectedId(threads[0]!.id);
    if (threads.length === 0) setSelectedId(null);
  }, [selectedThread, threads]);

  const selectedContact = selectedThread ? contactById.get(selectedThread.contact_id) : undefined;

  return (
    <div className="grid h-[calc(100dvh-112px)] grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_300px]">
      <ConversationSidebar
        threads={filteredThreads}
        totalCount={threads.length}
        filter={filter}
        onFilterChange={setFilter}
        selectedId={selectedId}
        onSelect={setSelectedId}
        members={members}
        contacts={contacts}
      />

      <ChatCanvas
        thread={selectedThread}
        contact={selectedContact}
        members={members}
      />

      <div className="hidden min-h-0 xl:block">
        <ContactContextPanel contact={selectedContact} conversation={selectedThread} />
      </div>
    </div>
  );
}
