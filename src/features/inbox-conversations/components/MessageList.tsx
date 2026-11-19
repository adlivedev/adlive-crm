"use client";

/**
 * M5 — Lienzo de mensajes del chat activo.
 * Salientes en Violeta ADlive (#5B00FF), entrantes en blanco con borde sutil.
 * Soporta texto, plantillas, imágenes y reproductor visual de notas de voz.
 */

import { AlertCircle, Check, CheckCheck, FileText, Image as ImageIcon, Mic } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Message } from "@/shared/types/database";

/** URL de reproducción: archivo directo o descarga autenticada desde Meta con el media_id. */
function playbackUrl(message: Message): string | null {
  if (message.media_url?.startsWith("https://")) return message.media_url;
  if (message.media_id) return `/api/v1/messages/${message.id}/media`;
  return null;
}

function VoiceNoteBubble({ message }: { message: Message }) {
  const mediaUrl = playbackUrl(message);
  if (mediaUrl) return <audio controls preload="none" src={mediaUrl} className="h-10 w-64 max-w-full" aria-label="Nota de voz" />;
  return (
    <span className="inline-flex items-center gap-2">
      <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      <span>{message.body ?? "Nota de voz"}<span className="block text-[11px] opacity-70">Audio no disponible.</span></span>
    </span>
  );
}

function MediaBubble({ message }: { message: Message }) {
  const mediaUrl = playbackUrl(message);
  const label = message.msg_type === "document" ? "Documento" : message.msg_type === "video" ? "Video" : "Imagen";
  return (
    <span className="flex max-w-64 flex-col gap-1.5">
      <span className="inline-flex items-center gap-2">
        {message.msg_type === "document" ? <FileText className="h-4 w-4" aria-hidden /> : <ImageIcon className="h-4 w-4" aria-hidden />}
        {mediaUrl ? <a href={mediaUrl} target="_blank" rel="noreferrer" className="underline">Abrir {label.toLowerCase()}</a> : `${label} no disponible`}
      </span>
      {message.body ? <span className="text-[11px] opacity-80">{message.body}</span> : null}
    </span>
  );
}

function DeliveryStatus({ message }: { message: Message }) {
  const labels = { queued: "En cola", sent: "Enviado", delivered: "Entregado", read: "Leído", failed: "Fallido" } as const;
  return (
    <span className="inline-flex items-center gap-1" title={message.error_reason ?? labels[message.status]}>
      {message.status === "failed" ? <AlertCircle className="h-3.5 w-3.5 text-adlive-danger" aria-hidden /> : message.status === "sent" || message.status === "queued" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <CheckCheck className={`h-3.5 w-3.5 ${message.status === "read" ? "text-adlive-cyan" : ""}`} aria-hidden />}
      <span>{labels[message.status]}</span>
    </span>
  );
}

export function MessageList({ conversationId }: { conversationId: string }) {
  const { messages } = useCrm();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(
    () =>
      messages
        .filter((message) => message.conversation_id === conversationId)
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, conversationId],
  );

  /* Mantener el scroll pegado al último mensaje. */
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [conversationMessages.length]);

  return (
    <div
      ref={scrollRef}
      aria-live="polite"
      aria-label="Historial del chat de WhatsApp"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#efeae2] px-4 py-4"
    >
      {conversationMessages.length === 0 ? (
        <p className="my-auto text-center text-sm text-adlive-text-muted">
          Aún no hay mensajes en esta conversación.
          <span className="mt-1 block text-xs">Los mensajes verificados de WhatsApp aparecerán aquí en tiempo real.</span>
        </p>
      ) : (
        conversationMessages.map((message) => {
          const isOutbound = message.direction === "outbound";
          return (
            <div key={message.id} className={`flex max-w-[80%] flex-col gap-1 ${isOutbound ? "self-end items-end" : "self-start items-start"}`}>
              {message.template_name ? (
                <Badge tone="neutral" className="bg-white/70">
                  Plantilla: {message.template_name}
                </Badge>
              ) : null}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                  isOutbound
                    ? "rounded-br-md bg-adlive-primary text-adlive-text-inverse"
                    : "rounded-bl-md border border-adlive-border bg-white text-adlive-text-main"
                }`}
              >
                {message.msg_type === "audio" ? (
                  <VoiceNoteBubble message={message} />
                ) : message.msg_type === "image" || message.msg_type === "video" || message.msg_type === "document" ? (
                  <MediaBubble message={message} />
                ) : (
                  message.body
                )}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-adlive-text-muted">
                {formatTime(message.created_at)}
                {isOutbound ? <DeliveryStatus message={message} /> : null}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
