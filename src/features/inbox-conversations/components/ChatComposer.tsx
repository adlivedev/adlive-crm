"use client";

/**
 * M5 — Barra de envío inferior del chat.
 * - Plantillas de WhatsApp, texto libre y respuestas rápidas.
 * - Escritura libre siempre habilitada: el servidor valida la ventana de 24 h de
 *   Meta y devuelve un error claro si el envío libre no está permitido.
 */

import { FileText, ImagePlus, SendHorizonal, X, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { createClient, isSupabaseBrowserConfigured } from "@/shared/lib/supabase/client";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, Conversation, WhatsAppTemplate } from "@/shared/types/database";

import { QUICK_REPLIES, fillTemplateBody } from "./inboxUtils";

const MAX_ATTACH_BYTES = 2 * 1024 * 1024; // límite estricto: 2 MB

export function ChatComposer({ conversation, contact }: { conversation: Conversation; contact: Contact }) {
  const { templates, sendMessage, isMutating } = useCrm();
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState<"template" | "quick" | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const approvedTemplates = useMemo(() => templates.filter((template) => template.status === "APPROVED"), [templates]);

  const handleSend = async () => {
    const body = draft.trim() || (attachment ? "📷 Imagen" : "");
    if ((!body && !attachment) || isMutating) return;
    try {
      await sendMessage(conversation.id, {
        body,
        ...(attachment ? { msg_type: "image" as const, media_url: attachment.url } : {}),
      });
      setDraft("");
      setAttachment(null);
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  /* Adjuntar imagen: valida 2 MB y sube al bucket chat-media del tenant. */
  const handleAttach = async (file: File) => {
    setAttachError(null);
    if (!file.type.startsWith("image/")) {
      setAttachError("Solo se permiten imágenes.");
      return;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError("La imagen supera el límite de 2 MB.");
      return;
    }
    if (!isSupabaseBrowserConfigured()) {
      setAttachError("El almacenamiento no está configurado.");
      return;
    }
    try {
      const supabase = createClient();
      const path = `${conversation.tenant_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("chat-media").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
      setAttachment({ url: data.publicUrl, name: file.name });
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    }
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
    if (isMutating) return;
    try {
      await sendMessage(conversation.id, { body: reply });
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  return (
    <div className="border-t border-adlive-border px-4 py-3">
      {/* Selector desplegable (plantillas / respuestas rápidas) */}
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
                      className="w-full cursor-pointer rounded-lg border border-adlive-border bg-white px-3 py-2 text-left text-xs leading-5 text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/50"
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

      {/* Vista previa del adjunto + errores */}
      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-adlive-border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.name} className="h-12 w-12 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs text-adlive-text-main">{attachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Quitar imagen adjunta"
            className="cursor-pointer rounded-full p-1 text-adlive-text-muted hover:text-adlive-danger"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {attachError ? (
        <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-adlive-danger">{attachError}</p>
      ) : null}

      {/* Fila de herramientas + input */}
      <div className="flex items-center gap-1.5">
        <ComposerToolButton label="Insertar plantilla de WhatsApp" active={picker === "template"} onClick={() => setPicker(picker === "template" ? null : "template")}>
          <FileText className="h-4 w-4" aria-hidden />
        </ComposerToolButton>
        <ComposerToolButton label="Adjuntar imagen (máx. 2 MB)" active={false} onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden />
        </ComposerToolButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Seleccionar imagen para adjuntar"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleAttach(file);
            event.target.value = "";
          }}
        />
        <ComposerToolButton label="Respuestas rápidas" active={picker === "quick"} onClick={() => setPicker(picker === "quick" ? null : "quick")}>
          <Zap className="h-4 w-4" aria-hidden />
        </ComposerToolButton>

        <label htmlFor="chat-input" className="sr-only">
          Escribe un mensaje
        </label>
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
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={!draft.trim() && !attachment}
          aria-label="Enviar mensaje"
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
