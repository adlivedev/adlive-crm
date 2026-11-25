"use client";

/**
 * M5 — Barra de envío inferior del chat.
 * - Plantillas de WhatsApp, texto libre y respuestas rápidas.
 * - Escritura libre siempre habilitada: el servidor valida la ventana de 24 h de
 *   Meta y devuelve un error claro si el envío libre no está permitido.
 */

import { FileText, ImagePlus, MousePointerClick, Plus, SendHorizonal, Trash2, X, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { createClient, isSupabaseBrowserConfigured } from "@/shared/lib/supabase/client";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, Conversation, WhatsAppTemplate } from "@/shared/types/database";

import { QUICK_REPLIES, fillTemplateBody } from "./inboxUtils";

const MAX_ATTACH_BYTES = 2 * 1024 * 1024; // límite estricto: 2 MB

interface InteractiveButton { title: string; url?: string }

/** Sube una imagen al bucket chat-media del tenant y devuelve la URL pública. */
async function uploadChatImage(file: File, tenantId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Solo se permiten imágenes.");
  if (file.size > MAX_ATTACH_BYTES) throw new Error("La imagen supera el límite de 2 MB.");
  if (!isSupabaseBrowserConfigured()) throw new Error("El almacenamiento no está configurado.");
  const supabase = createClient();
  const path = `${tenantId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}

/** Mini-parser de *negrita* de WhatsApp para la vista previa. */
function renderWhatsAppBold(text: string): React.ReactNode {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((token, index) =>
    token.length > 2 && token.startsWith("*") && token.endsWith("*")
      ? <strong key={index} className="font-semibold">{token.slice(1, -1)}</strong>
      : <span key={index}>{token}</span>,
  );
}

export function ChatComposer({ conversation, contact }: { conversation: Conversation; contact: Contact }) {
  const { templates, sendMessage, isMutating } = useCrm();
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState<"template" | "quick" | "interactive" | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Constructor de mensaje interactivo (botones de respuesta o CTA con enlace).
  const [ixBody, setIxBody] = useState("");
  const [ixFooter, setIxFooter] = useState("");
  const [ixHeaderImage, setIxHeaderImage] = useState<{ url: string; name: string } | null>(null);
  const [ixButtonKind, setIxButtonKind] = useState<"reply" | "cta_url">("reply");
  const [ixButtons, setIxButtons] = useState<InteractiveButton[]>([{ title: "" }]);
  const ixFileRef = useRef<HTMLInputElement | null>(null);

  const approvedTemplates = useMemo(() => templates.filter((template) => template.status === "APPROVED"), [templates]);

  const ixValidButtons = ixButtons.filter((button) => button.title.trim().length > 0);
  const ixReady = ixBody.trim().length > 0 && ixValidButtons.length > 0
    && (ixButtonKind === "reply" || ixValidButtons.every((button) => (button.url ?? "").trim().length > 0));

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
    try {
      const url = await uploadChatImage(file, conversation.tenant_id);
      setAttachment({ url, name: file.name });
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    }
  };

  const handleIxHeaderImage = async (file: File) => {
    setAttachError(null);
    try {
      const url = await uploadChatImage(file, conversation.tenant_id);
      setIxHeaderImage({ url, name: file.name });
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "No se pudo subir la imagen del header.");
    }
  };

  const resetInteractive = () => {
    setIxBody(""); setIxFooter(""); setIxHeaderImage(null); setIxButtonKind("reply"); setIxButtons([{ title: "" }]);
  };

  /* Envía el mensaje interactivo: el cuerpo persistido resume el texto y los botones. */
  const handleSendInteractive = async () => {
    if (!ixReady || isMutating) return;
    const buttons = ixValidButtons.map((button) => ({
      kind: ixButtonKind, title: button.title.trim().slice(0, 20), ...(ixButtonKind === "cta_url" ? { url: button.url!.trim() } : {}),
    }));
    const historyBody = `${ixBody.trim()}\n\n${buttons.map((button) => `[${ixButtonKind === "cta_url" ? "Enlace" : "Botón"}: ${button.title}]`).join("\n")}`;
    try {
      await sendMessage(conversation.id, {
        body: historyBody.slice(0, 4096),
        msg_type: "interactive",
        interactive: { body: ixBody.trim(), footer: ixFooter.trim() || undefined, header_image_url: ixHeaderImage?.url ?? null, buttons },
      });
      resetInteractive();
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
    if (isMutating) return;
    try {
      await sendMessage(conversation.id, { body: reply });
      setPicker(null);
    } catch { /* El store muestra el error real del servidor. */ }
  };

  return (
    <div className="border-t border-adlive-border px-4 py-3">
      {/* Selector desplegable (plantillas / respuestas rápidas) */}
      {picker === "interactive" ? (
        <div className="mb-2 rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 p-3" aria-label="Constructor de mensaje interactivo">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Formulario */}
            <div className="flex flex-col gap-3">
              <PickerTitle>Mensaje interactivo con botones</PickerTitle>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ix-body" className="text-xs font-medium text-adlive-text-main">Cuerpo del mensaje <span aria-hidden className="text-adlive-danger">*</span></label>
                <textarea
                  id="ix-body" value={ixBody} onChange={(event) => setIxBody(event.target.value.slice(0, 1024))}
                  rows={4} placeholder="Hola {{nombre}}, elige una opción para continuar."
                  className="w-full resize-y rounded-lg border border-adlive-border bg-white px-3 py-2 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ix-footer" className="text-xs font-medium text-adlive-text-main">Pie de página (opcional)</label>
                <input id="ix-footer" value={ixFooter} onChange={(event) => setIxFooter(event.target.value.slice(0, 60))} placeholder="Responde con el número de opción"
                  className="h-9 w-full rounded-lg border border-adlive-border bg-white px-3 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20" />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => ixFileRef.current?.click()} disabled={isMutating}>
                  <ImagePlus className="mr-1 h-3.5 w-3.5" aria-hidden /> Imagen de cabecera
                </Button>
                <input ref={ixFileRef} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen de cabecera"
                  onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleIxHeaderImage(file); event.target.value = ""; }} />
                {ixHeaderImage ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-adlive-text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ixHeaderImage.url} alt="" className="h-7 w-7 rounded object-cover" />
                    <span className="max-w-28 truncate">{ixHeaderImage.name}</span>
                    <button type="button" onClick={() => setIxHeaderImage(null)} aria-label="Quitar imagen de cabecera" className="cursor-pointer text-adlive-text-muted hover:text-adlive-danger"><X className="h-3.5 w-3.5" aria-hidden /></button>
                  </span>
                ) : <span className="text-xs text-adlive-text-muted">Opcional · máx. 2 MB</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-adlive-text-main">Tipo de botones</span>
                <div className="flex gap-2">
                  {([["reply", "Respuestas rápidas (máx. 3)"], ["cta_url", "Botón con enlace"]] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={ixButtonKind === value}
                      onClick={() => { setIxButtonKind(value); setIxButtons([{ title: "" }]); }}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${ixButtonKind === value ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/40"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {ixButtons.map((button, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input value={button.title} maxLength={20} placeholder={ixButtonKind === "reply" ? `Botón ${index + 1} (máx. 20 caracteres)` : "Texto del botón (máx. 20)"}
                      aria-label={`Botón ${index + 1}`}
                      onChange={(event) => setIxButtons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-adlive-border bg-white px-3 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20" />
                    {ixButtonKind === "cta_url" ? (
                      <input value={button.url ?? ""} placeholder="https://…" aria-label="URL del botón"
                        onChange={(event) => setIxButtons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-adlive-border bg-white px-3 font-mono text-xs focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20" />
                    ) : null}
                    {ixButtons.length > 1 ? (
                      <button type="button" aria-label={`Eliminar botón ${index + 1}`}
                        onClick={() => setIxButtons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted hover:text-adlive-danger"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                    ) : null}
                  </div>
                ))}
                {ixButtonKind === "reply" && ixButtons.length < 3 ? (
                  <button type="button" onClick={() => setIxButtons((current) => [...current, { title: "" }])}
                    className="flex cursor-pointer items-center gap-1 self-start text-xs font-semibold text-adlive-primary hover:underline">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Añadir botón
                  </button>
                ) : null}
              </div>
            </div>
            {/* Vista previa en vivo estilo burbuja de WhatsApp */}
            <div className="flex flex-col gap-2">
              <PickerTitle>Vista previa en vivo</PickerTitle>
              <div className="flex flex-1 flex-col justify-end rounded-xl bg-[#ECE5DD] p-3">
                <div className="max-w-full overflow-hidden rounded-xl rounded-tl-none bg-white shadow-sm">
                  {ixHeaderImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={ixHeaderImage.url} alt="" className="max-h-36 w-full object-cover" />
                  ) : null}
                  <div className="p-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-adlive-text-main">
                      {ixBody.trim().length > 0 ? renderWhatsAppBold(ixBody) : <span className="text-adlive-text-muted/60">Escribe el cuerpo del mensaje…</span>}
                    </p>
                    {ixFooter.trim().length > 0 ? <p className="mt-2 border-t border-adlive-border/60 pt-1.5 text-[11px] text-adlive-text-muted">{ixFooter}</p> : null}
                  </div>
                  {ixValidButtons.length > 0 ? (
                    <div className="flex flex-col border-t border-adlive-border/60">
                      {ixButtons.filter((button) => button.title.trim().length > 0).map((button, index) => (
                        <p key={index} className="border-b border-adlive-border/40 px-3 py-2 text-center text-[12px] font-semibold text-adlive-primary last:border-b-0">
                          {button.title}{ixButtonKind === "cta_url" && button.url ? <span className="block truncate text-[9px] font-normal text-adlive-text-muted">{button.url}</span> : null}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-adlive-border/60 pt-3">
            <button type="button" onClick={() => { resetInteractive(); setPicker(null); }} className="cursor-pointer text-xs font-semibold text-adlive-text-muted hover:text-adlive-text-main">Cancelar</button>
            <Button type="button" variant="primary" size="sm" onClick={() => void handleSendInteractive()} disabled={!ixReady || isMutating} isLoading={isMutating}>
              <SendHorizonal className="mr-1 h-3.5 w-3.5" aria-hidden /> Enviar interactivo
            </Button>
          </div>
        </div>
      ) : picker ? (
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
        <ComposerToolButton label="Mensaje interactivo con botones" active={picker === "interactive"} onClick={() => setPicker(picker === "interactive" ? null : "interactive")}>
          <MousePointerClick className="h-4 w-4" aria-hidden />
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
