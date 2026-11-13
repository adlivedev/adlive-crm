"use client";

/**
 * M5 — Pestaña «Adjuntos»: piezas multimedia intercambiadas en la conversación
 * (imágenes, notas de voz, videos y documentos) con enlace al mensaje.
 */

import { FileText, Image as ImageIcon, Mic, Video } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Conversation, MessageType } from "@/shared/types/database";

const MEDIA_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  audio: Mic,
  video: Video,
  document: FileText,
};

export function ContextAttachmentsPanel({ conversation }: { conversation: Conversation | null }) {
  const { messages } = useCrm();

  if (!conversation) {
    return <p className="p-4 text-center text-xs text-adlive-text-muted">Selecciona una conversación para ver sus adjuntos.</p>;
  }

  const mediaMessages = messages
    .filter(
      (message) =>
        message.conversation_id === conversation.id &&
        (["image", "audio", "video", "document"] as MessageType[]).includes(message.msg_type),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-adlive-text-muted">Adjuntos de la conversación</h4>
      {mediaMessages.length === 0 ? (
        <p className="py-4 text-center text-xs text-adlive-text-muted">
          Aún no hay archivos adjuntos. Usa el botón de adjuntar del chat para simular uno.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mediaMessages.map((message) => {
            const Icon = MEDIA_ICONS[message.msg_type] ?? FileText;
            const directionLabel = message.direction === "outbound" ? "Enviado por el asesor" : "Recibido del cliente";
            return (
              <li key={message.id} className="flex items-center gap-2.5 rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-adlive-primary/10 text-adlive-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-adlive-text-main">
                    {message.body ?? message.media_mime_type ?? "Archivo"}
                  </span>
                  <span className="block text-[10px] text-adlive-text-muted">
                    {directionLabel} · {formatRelativeTime(message.created_at)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
