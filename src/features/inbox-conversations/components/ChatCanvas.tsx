"use client";

import { ArrowLeft, Info } from "lucide-react";

import type { Contact, ConversationWithDetails, TenantMember } from "@/shared/types/database";

import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";

interface ChatCanvasProps {
  thread: ConversationWithDetails | null;
  contact: Contact | undefined;
  members: TenantMember[];
  onBack: () => void;
  onOpenInfo: () => void;
}

export function ChatCanvas({ thread, contact, members, onBack, onOpenInfo }: ChatCanvasProps) {
  if (!thread || !contact) {
    return <section aria-label="Conversación activa" className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-adlive-border bg-white"><p className="px-6 text-center text-sm text-adlive-text-muted">Selecciona una conversación de la bandeja para atenderla.<span className="mt-1 block text-xs">Los filtros de tipificación y asignación aceleran el reparto del equipo.</span></p></section>;
  }
  return (
    <section aria-label="Conversación activa" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-adlive-border bg-white">
      <div className="flex items-center justify-between border-b border-adlive-border bg-white px-2 py-1.5 xl:hidden">
        <button type="button" onClick={onBack} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-adlive-primary hover:bg-adlive-primary-light lg:hidden"><ArrowLeft className="h-4 w-4" aria-hidden />Conversaciones</button>
        <span className="hidden text-xs font-medium text-adlive-text-muted lg:block">Conversación activa</span>
        <button type="button" onClick={onOpenInfo} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-adlive-primary hover:bg-adlive-primary-light"><Info className="h-4 w-4" aria-hidden />Info</button>
      </div>
      <ChatHeader thread={thread} contact={contact} members={members} />
      <MessageList conversationId={thread.id} />
      <ChatComposer conversation={thread} contact={contact} />
    </section>
  );
}
