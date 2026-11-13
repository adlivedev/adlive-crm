"use client";

/**
 * Widget inferior «Conversaciones recientes»: últimos contactos que escribieron,
 * con ícono de nota de voz, badge rojo «Sin responder» y tiempo relativo.
 */

import { Mic, MessageCircle } from "lucide-react";

import { Badge } from "@/shared/components/ui/Badge";
import { Card, CardHeader } from "@/shared/components/ui/Card";
import { formatRelativeTime, initials } from "@/shared/lib/format";
import type { Contact, Conversation } from "@/shared/types/database";

export interface RecentConversationsProps {
  conversations: Conversation[];
  contacts: Contact[];
}

export function RecentConversations({ conversations, contacts }: RecentConversationsProps) {
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const recent = [...conversations]
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
    .slice(0, 6);

  return (
    <Card>
      <CardHeader title="Conversaciones recientes" subtitle="Últimos mensajes de tus contactos" />
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <MessageCircle className="h-8 w-8 text-adlive-text-muted/40" aria-hidden />
          <p className="text-sm text-adlive-text-muted">Todavía no hay conversaciones en esta cuenta.</p>
        </div>
      ) : (
        <ul className="divide-y divide-adlive-border">
          {recent.map((conversation) => {
            const contact = contactById.get(conversation.contact_id);
            const name = contact?.full_name ?? "Contacto";
            return (
              <li key={conversation.id} className="flex items-center gap-4 px-6 py-4 transition-colors duration-150 hover:bg-adlive-canvas-bg/60">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-adlive-primary-light font-mono text-sm font-bold text-adlive-primary"
                >
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-adlive-text-main">{name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-adlive-text-muted">
                    {conversation.last_message_media_type === "audio" ? (
                      <>
                        <Mic className="h-3.5 w-3.5 shrink-0 text-adlive-cyan" aria-hidden />
                        <span>Nota de voz</span>
                      </>
                    ) : (
                      <span className="truncate">{conversation.last_message_preview ?? "Sin mensajes"}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {conversation.needs_reply ? <Badge tone="danger">Sin responder</Badge> : null}
                  <span className="text-xs text-adlive-text-muted">{formatRelativeTime(conversation.last_message_at)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
