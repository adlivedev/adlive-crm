"use client";

/**
 * M5 — Lienzo de mensajes del chat activo.
 * Salientes en Violeta ADlive (#5B00FF), entrantes en blanco con borde sutil.
 * Soporta texto, plantillas, imágenes y reproductor visual de notas de voz.
 */

import { CheckCheck, FileText, Image as ImageIcon, Mic, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Message } from "@/shared/types/database";

/** Reproductor visual simulado de nota de voz (progreso animado con setInterval). */
function VoiceNoteBubble({ message, isOutbound }: { message: Message; isOutbound: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(interval);
          setPlaying(false);
          return 0;
        }
        return current + 4;
      });
    }, 120);
    return () => window.clearInterval(interval);
  }, [playing]);

  const barColor = isOutbound ? "bg-white/40" : "bg-adlive-primary/20";

  return (
    <span className="flex w-56 items-center gap-2.5">
      <button
        type="button"
        onClick={() => setPlaying((current) => !current)}
        aria-label={playing ? "Pausar nota de voz" : "Reproducir nota de voz"}
        className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full ${
          isOutbound ? "bg-white text-adlive-primary" : "bg-adlive-primary text-white"
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <span className="flex flex-1 flex-col gap-1">
        <span className={`flex h-1.5 w-full overflow-hidden rounded-full ${barColor}`} aria-hidden>
          <span className="h-full rounded-full bg-current transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </span>
        <span className="text-[11px] opacity-80">{message.body ?? "Nota de voz"}</span>
      </span>
      <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </span>
  );
}

/** Pieza multimedia (imagen simulada / documento) con caption. */
function MediaBubble({ message }: { message: Message }) {
  if (message.msg_type === "image" || message.msg_type === "video") {
    return (
      <span className="flex w-52 flex-col gap-1.5">
        <span className="flex h-36 items-center justify-center rounded-xl bg-black/15">
          <ImageIcon className="h-8 w-8 opacity-70" aria-hidden />
        </span>
        {message.body ? <span className="text-[11px] opacity-80">{message.body}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      {message.body ?? "Documento"}
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
          <span className="mt-1 block text-xs">Usa «Simular mensaje del cliente» para recibir uno en tiempo real.</span>
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
                  <VoiceNoteBubble message={message} isOutbound={isOutbound} />
                ) : message.msg_type === "image" || message.msg_type === "video" || message.msg_type === "document" ? (
                  <MediaBubble message={message} />
                ) : (
                  message.body
                )}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-adlive-text-muted">
                {formatTime(message.created_at)}
                {isOutbound ? (
                  <CheckCheck className="h-3.5 w-3.5 text-adlive-cyan" aria-label="Mensaje leído (doble check)" />
                ) : null}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
