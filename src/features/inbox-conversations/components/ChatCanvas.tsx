"use client";

/**
 * M5 — Columna 2: conversación activa en vivo.
 * Cabecera con acciones en caliente + lienzo de mensajes + barra de envío
 * con validador estricto de la ventana de 24 h de Meta.
 */

import { useCrm } from "@/shared/services/crmStore";
import type { Contact, ConversationWithDetails, TenantMember } from "@/shared/types/database";

import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { SIMULATED_INBOUND_MESSAGES } from "./inboxUtils";

interface ChatCanvasProps {
  thread: ConversationWithDetails | null;
  contact: Contact | undefined;
  members: TenantMember[];
}

export function ChatCanvas({ thread, contact, members }: ChatCanvasProps) {
  const { receiveInboundMessage } = useCrm();

  if (!thread || !contact) {
    return (
      <section
        aria-label="Conversación activa"
        className="flex min-h-0 items-center justify-center rounded-2xl border border-adlive-border bg-white"
      >
        <p className="px-6 text-center text-sm text-adlive-text-muted">
          Selecciona una conversación de la bandeja para atenderla.
          <span className="mt-1 block text-xs">Los filtros de tipificación y asignación aceleran el reparto del Call Center.</span>
        </p>
      </section>
    );
  }

  const handleSimulateInbound = () => {
    const body = SIMULATED_INBOUND_MESSAGES[Math.floor(Math.random() * SIMULATED_INBOUND_MESSAGES.length)]!;
    receiveInboundMessage(thread.id, body);
  };

  return (
    <section aria-label="Conversación activa" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-adlive-border bg-white">
      <ChatHeader
        thread={thread}
        contact={contact}
        members={members}
        onSimulateInbound={handleSimulateInbound}
      />
      <MessageList conversationId={thread.id} />
      <ChatComposer conversation={thread} contact={contact} />
    </section>
  );
}
