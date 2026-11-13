"use client";

/**
 * M3 — Columna central de la ficha 360°: conversación de WhatsApp.
 *
 * - Burbujas salientes en Violeta ADlive (#5B00FF) con hora y doble check.
 * - VALIDADOR ESTRICTO de la ventana de 24 h de Meta: si
 *   NOW() − last_inbound_at > 24 h, se muestra el banner gris con ícono de
 *   reloj, se bloquea el input libre (placeholder «Ventana de 24 h cerrada»)
 *   y solo queda habilitado `Enviar plantilla` (selector rápido de plantillas
 *   aprobadas que envía al chat).
 * - `Simular respuesta entrante del cliente` abre la ventana en vivo
 *   (crea la conversación si el contacto aún no tiene una).
 */

import { CheckCheck, Clock3, ExternalLink, Mic, MousePointerClick, SendHorizonal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatRelativeTime, formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, Conversation, WhatsAppTemplate } from "@/shared/types/database";

/** Regla de Meta Cloud API: la sesión de atención dura 24 h desde el último mensaje entrante. */
export const META_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Reloj interno que se actualiza cada 30 s para re-evaluar la ventana en vivo. */
const CLOCK_TICK_MS = 30_000;

const SIMULATED_INBOUND_MESSAGES = [
  "Sí, me interesa el plan de 50GB. ¿Cómo empezamos con la portabilidad?",
  "Buenas, ¿sigue disponible la oferta de $38.000 con llamadas ilimitadas?",
  "Claro, te envío la cédula y el NIP por aquí mismo.",
  "Perfecto, ¿para cuándo me llegaría la SIM nueva?",
];

/** Reemplaza las variables {{1}}, {{2}}… con datos del contacto. */
function fillTemplateBody(template: WhatsAppTemplate, contact: Contact): string {
  const firstName = contact.full_name.trim().split(/\s+/)[0] ?? contact.full_name;
  return template.body_text
    .replaceAll("{{1}}", firstName)
    .replaceAll("{{2}}", "$38.000")
    .replaceAll("{{3}}", "50GB + llamadas ilimitadas");
}

export function ConversationPanel({ contact, conversation }: { contact: Contact; conversation: Conversation | null }) {
  const { messages, templates, sendMessage, receiveInboundMessage, ensureConversation } = useCrm();
  const [draft, setDraft] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(
    () =>
      conversation
        ? messages
            .filter((message) => message.conversation_id === conversation.id)
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
        : [],
    [messages, conversation],
  );

  const approvedTemplates = useMemo(() => templates.filter((template) => template.status === "APPROVED"), [templates]);

  /* Reloj vivo: la ventana se re-evalúa sola aunque el usuario no interactúe. */
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  /* Mantener el scroll pegado al último mensaje. */
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [conversationMessages.length]);

  const lastInboundAt = conversation?.last_inbound_at ?? null;
  const elapsedMs = lastInboundAt ? nowTick.getTime() - new Date(lastInboundAt).getTime() : null;
  const isWindowOpen = elapsedMs !== null && elapsedMs < META_WINDOW_MS;
  const remainingMs = elapsedMs !== null ? Math.max(0, META_WINDOW_MS - elapsedMs) : 0;
  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const remainingMinutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  const handleSendFreeMessage = () => {
    const body = draft.trim();
    if (!body || !isWindowOpen) return;
    const conversationId = conversation ? conversation.id : ensureConversation(contact.id);
    sendMessage(conversationId, { body });
    setDraft("");
  };

  const handleSendTemplate = (template: WhatsAppTemplate) => {
    const conversationId = conversation ? conversation.id : ensureConversation(contact.id);
    sendMessage(conversationId, {
      body: fillTemplateBody(template, contact),
      msg_type: "template",
      template_name: template.name,
    });
    setTemplatePickerOpen(false);
  };

  const handleSimulateInbound = () => {
    const conversationId = conversation ? conversation.id : ensureConversation(contact.id);
    const body = SIMULATED_INBOUND_MESSAGES[Math.floor(Math.random() * SIMULATED_INBOUND_MESSAGES.length)]!;
    receiveInboundMessage(conversationId, body);
  };

  return (
    <Card className="flex min-h-[560px] flex-col">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-adlive-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-adlive-text-main">Conversación</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-adlive-text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-adlive-success" aria-hidden />
            WhatsApp · conectado
          </p>
        </div>
        <Link
          href="/conversaciones"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-adlive-primary transition-colors hover:bg-adlive-primary-light"
        >
          Abrir en Conversaciones
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* Validador estricto de la ventana de 24 horas de Meta */}
      {conversation && !isWindowOpen ? (
        <div className="flex items-start gap-3 border-b border-adlive-border bg-adlive-canvas-bg px-5 py-3.5" role="status">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-adlive-text-muted" aria-hidden />
          <p className="text-sm leading-6 text-adlive-text-muted">
            Pasaron más de 24 h desde el último mensaje del cliente. Solo puedes enviarle una plantilla aprobada.
            {lastInboundAt ? (
              <span className="block text-xs">Último mensaje entrante: {formatRelativeTime(lastInboundAt)}.</span>
            ) : (
              <span className="block text-xs">Este chat aún no ha recibido mensajes del cliente.</span>
            )}
          </p>
        </div>
      ) : conversation && isWindowOpen ? (
        <div className="flex items-center gap-2 border-b border-adlive-border bg-emerald-50/70 px-5 py-2.5" role="status">
          <span className="inline-block h-2 w-2 rounded-full bg-adlive-success" aria-hidden />
          <p className="text-xs font-medium text-emerald-700">
            Ventana de 24 h activa · quedan {remainingHours} h {remainingMinutes} min para responder sin plantilla.
          </p>
        </div>
      ) : null}

      {/* Lienzo de mensajes */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#efeae2] px-5 py-4" aria-live="polite" aria-label="Historial del chat de WhatsApp">
        {conversationMessages.length === 0 ? (
          <p className="my-auto text-center text-sm text-adlive-text-muted">
            Aún no hay mensajes en esta conversación.
            <span className="mt-1 block text-xs">Usa «Simular respuesta entrante del cliente» para abrir la ventana de 24 h en vivo.</span>
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
                    <span className="inline-flex items-center gap-2">
                      <Mic className="h-4 w-4" aria-hidden />
                      {message.body ?? "Nota de voz"}
                    </span>
                  ) : (
                    message.body
                  )}
                </div>
                <span className={`flex items-center gap-1 text-[11px] ${isOutbound ? "text-adlive-text-muted" : "text-adlive-text-muted/80"}`}>
                  {formatTime(message.created_at)}
                  {isOutbound ? <CheckCheck className="h-3.5 w-3.5 text-adlive-cyan" aria-label="Mensaje leído (doble check)" /> : null}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Compositor */}
      <div className="flex flex-col gap-2.5 border-t border-adlive-border px-5 py-4">
        {templatePickerOpen ? (
          <div className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 p-3" role="listbox" aria-label="Plantillas aprobadas disponibles">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">
              Plantillas aprobadas ({approvedTemplates.length})
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {approvedTemplates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => handleSendTemplate(template)}
                    className="w-full cursor-pointer rounded-lg border border-adlive-border bg-white px-3 py-2.5 text-left text-sm text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/50"
                  >
                    <span className="block font-semibold">{template.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-adlive-text-muted">{fillTemplateBody(template, contact)}</span>
                  </button>
                </li>
              ))}
              {approvedTemplates.length === 0 ? (
                <li className="px-1 text-sm text-adlive-text-muted">No hay plantillas aprobadas en esta cuenta.</li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => setTemplatePickerOpen(false)}
              className="mt-2 cursor-pointer text-xs font-semibold text-adlive-text-muted hover:text-adlive-text-main"
            >
              Cerrar selector
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {isWindowOpen ? (
            <>
              <label htmlFor="ficha-input-chat" className="sr-only">
                Escribe un mensaje
              </label>
              <input
                id="ficha-input-chat"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendFreeMessage();
                }}
                placeholder="Escribe un mensaje…"
                className="h-11 flex-1 rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
              />
              <Button type="button" variant="primary" size="sm" onClick={handleSendFreeMessage} disabled={!draft.trim()} aria-label="Enviar mensaje" className="h-11 w-11 shrink-0 px-0">
                <SendHorizonal className="h-4 w-4" aria-hidden />
              </Button>
            </>
          ) : (
            <>
              <input
                type="text"
                value=""
                disabled
                placeholder="Ventana de 24 h cerrada"
                aria-label="Ventana de 24 horas cerrada: el envío libre está bloqueado"
                className="h-11 flex-1 cursor-not-allowed rounded-xl border border-adlive-border bg-adlive-canvas-bg px-4 text-sm text-adlive-text-muted"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setTemplatePickerOpen((open) => !open)}
                aria-expanded={templatePickerOpen}
                className="h-11 shrink-0"
              >
                Enviar plantilla
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleSimulateInbound}
          className="inline-flex cursor-pointer items-center gap-1.5 self-start text-xs font-semibold text-adlive-text-muted transition-colors hover:text-adlive-primary"
        >
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          Simular respuesta entrante del cliente
        </button>
      </div>
    </Card>
  );
}
