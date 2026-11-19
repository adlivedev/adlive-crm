"use client";

/**
 * M5 — Barra de envío inferior del chat.
 * - Plantillas de WhatsApp, texto y respuestas rápidas.
 * - Envío con Enter respetando el VALIDADOR ESTRICTO de la ventana de 24 h de Meta:
 *   ventana cerrada → input bloqueado y solo «Enviar plantilla» habilitado.
 */

import { Clock3, FileText, SendHorizonal, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { META_WINDOW_MS } from "@/shared/lib/whatsapp";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, Conversation, WhatsAppTemplate } from "@/shared/types/database";

import { QUICK_REPLIES, fillTemplateBody, isMetaWindowOpen } from "./inboxUtils";

const CLOCK_TICK_MS = 30_000;

export function ChatComposer({ conversation, contact }: { conversation: Conversation; contact: Contact }) {
  const { templates, sendMessage, isMutating } = useCrm();
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState<"template" | "quick" | null>(null);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  /* Reloj vivo: la ventana de 24 h se re-evalúa sola. */
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  const approvedTemplates = useMemo(() => templates.filter((template) => template.status === "APPROVED"), [templates]);

  const windowOpen = isMetaWindowOpen(conversation, nowTick);
  const lastInboundAt = conversation.last_inbound_at;
  const remainingMs = windowOpen && lastInboundAt
    ? Math.max(0, META_WINDOW_MS - (nowTick.getTime() - new Date(lastInboundAt).getTime()))
    : 0;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !windowOpen || isMutating) return;
    try {
      await sendMessage(conversation.id, { body });
      setDraft("");
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  const handleSendTemplate = async (template: WhatsAppTemplate) => {
    if (isMutating) return;
    try {
      await sendMessage(conversation.id, {
        body: fillTemplateBody(template, contact),
        msg_type: "template",
        template_name: template.name,
      });
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  const handleQuickReply = async (reply: string) => {
    if (!windowOpen || isMutating) return;
    try {
      await sendMessage(conversation.id, { body: reply });
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  return (
    <div className="border-t border-adlive-border px-4 py-3">
      {/* Estado de la ventana de 24 h */}
      {lastInboundAt ? (
        windowOpen ? (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700" role="status">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-adlive-success" aria-hidden />
            Ventana de 24 h activa · quedan {Math.floor(remainingMs / 3_600_000)} h {Math.floor((remainingMs % 3_600_000) / 60_000)} min
          </p>
        ) : (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-adlive-text-muted" role="status">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Ventana de 24 h cerrada: solo puedes enviar una plantilla aprobada.
          </p>
        )
      ) : (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-adlive-text-muted" role="status">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          Aún no hay mensajes del cliente: usa una plantilla aprobada para iniciar la conversación.
        </p>
      )}

      {/* Selector desplegable (plantillas / adjuntos / respuestas rápidas) */}
      {picker ? (
        <div className="mb-2 rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 p-3" role="listbox" aria-label="Opciones de envío">
          {picker === "template" ? (
            <>
              <PickerTitle>Plantillas aprobadas ({approvedTemplates.length})</PickerTitle>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {approvedTemplates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => handleSendTemplate(template)}
                      className="w-full cursor-pointer rounded-lg border border-adlive-border bg-white px-3 py-2 text-left text-sm text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/50"
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
            </>
          ) : (
            <>
              <PickerTitle>Respuestas rápidas</PickerTitle>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {QUICK_REPLIES.map((reply) => (
                  <li key={reply}>
                    <button
                      type="button"
                      onClick={() => handleQuickReply(reply)}
                      disabled={!windowOpen}
                      className="w-full cursor-pointer rounded-lg border border-adlive-border bg-white px-3 py-2 text-left text-xs leading-5 text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={() => setPicker(null)}
            className="mt-2 cursor-pointer text-xs font-semibold text-adlive-text-muted hover:text-adlive-text-main"
          >
            Cerrar selector
          </button>
        </div>
      ) : null}

      {/* Fila de herramientas + input */}
      <div className="flex items-center gap-1.5">
        <ComposerToolButton label="Insertar plantilla de WhatsApp" active={picker === "template"} onClick={() => setPicker(picker === "template" ? null : "template")}>
          <FileText className="h-4 w-4" aria-hidden />
        </ComposerToolButton>
        <ComposerToolButton label="Respuestas rápidas" active={picker === "quick"} onClick={() => setPicker(picker === "quick" ? null : "quick")}>
          <Zap className="h-4 w-4" aria-hidden />
        </ComposerToolButton>

        <label htmlFor="chat-input" className="sr-only">
          Escribe un mensaje
        </label>
        {windowOpen ? (
          <input
            id="chat-input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            placeholder="Escribe un mensaje..."
            className="h-10 flex-1 rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        ) : (
          <input
            id="chat-input"
            type="text"
            value=""
            disabled
            placeholder="Ventana de 24 h cerrada"
            aria-label="Ventana de 24 horas cerrada: el envío libre está bloqueado"
            className="h-10 flex-1 cursor-not-allowed rounded-xl border border-adlive-border bg-adlive-canvas-bg px-3 text-sm text-adlive-text-muted"
          />
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={windowOpen ? handleSend : () => setPicker("template")}
          disabled={windowOpen && !draft.trim()}
          aria-label={windowOpen ? "Enviar mensaje" : "Enviar plantilla aprobada"}
          className="h-10 w-10 shrink-0 px-0"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function PickerTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">{children}</p>;
}

interface ComposerToolButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ComposerToolButton({ label, active, onClick, children }: ComposerToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        active
          ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary"
          : "border-adlive-border text-adlive-text-muted hover:border-adlive-primary/40 hover:text-adlive-primary"
      }`}
    >
      {children}
    </button>
  );
}
