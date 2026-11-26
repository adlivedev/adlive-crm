"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  const [infoOpen, setInfoOpen] = useState(false);
  /* QA-NEW-009: deep-link /conversaciones?open=<id> (correos de alerta y
     notificaciones) abre directamente el hilo indicado. */
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");

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
          contact_name: contact?.full_name ?? "Contacto no disponible",
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
    () => threads.filter((thread) => matchesInboxFilters(thread, contactById.get(thread.contact_id), filter)),
    [threads, contactById, filter],
  );

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? null;
  const selectedContact = selectedThread ? contactById.get(selectedThread.contact_id) : undefined;

  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);

  useEffect(() => {
    /* Solo se limpia la selección si el hilo no existe tras cargar las
       conversaciones (evita borrar el deep-link durante la carga inicial). */
    if (selectedId && !selectedThread && conversations.length > 0) {
      setSelectedId(null);
      setInfoOpen(false);
    }
  }, [selectedId, selectedThread, conversations.length]);

  useEffect(() => {
    if (!infoOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfoOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [infoOpen]);

  return (
    <div className="relative grid h-[calc(100dvh-88px)] grid-cols-1 gap-3 sm:h-[calc(100dvh-96px)] lg:h-[calc(100dvh-112px)] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[330px_minmax(0,1fr)_300px]">
      <div className={`${selectedId ? "hidden lg:flex" : "flex"} min-h-0 flex-col`}>
        <ConversationSidebar
          threads={filteredThreads}
          totalCount={threads.length}
          filter={filter}
          onFilterChange={setFilter}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setInfoOpen(false);
          }}
          members={members}
          contacts={contacts}
        />
      </div>

      <div className={`${selectedId ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`}>
        <ChatCanvas
          thread={selectedThread}
          contact={selectedContact}
          members={members}
          onBack={() => setSelectedId(null)}
          onOpenInfo={() => setInfoOpen(true)}
        />
      </div>

      <div className="hidden min-h-0 xl:block">
        <ContactContextPanel contact={selectedContact} conversation={selectedThread} />
      </div>

      {infoOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Información del contacto">
          <button
            type="button"
            aria-label="Cerrar información del contacto"
            onClick={() => setInfoOpen(false)}
            className="absolute inset-0 cursor-pointer bg-black/50"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl">
            <ContactContextPanel contact={selectedContact} conversation={selectedThread} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
