"use client";

/**
 * Modal `Crear plantilla` (M7) — dos columnas:
 * izquierda el formulario completo (nombre snake_case, categoría, idioma,
 * header opcional, barra de formato, variables {{n}}, footer y botones);
 * derecha la vista previa en vivo estilo WhatsApp. Reutiliza el Modal de M3.
 */

import { Bold, Code, Italic, Plus, Strikethrough } from "lucide-react";
import { useRef, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";
import type { WhatsAppTemplateButton } from "@/shared/types/database";

import { TemplateButtonsEditor } from "./TemplateButtonsEditor";
import { TemplatePreview } from "./TemplatePreview";
import { countVariables, isValidTemplateName, sanitizeButtons } from "./templateUtils";

const CATEGORY_OPTIONS = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utilidad" },
  { value: "AUTHENTICATION", label: "Autenticación" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
] as const;

const HEADER_OPTIONS = [
  { value: "NONE", label: "Sin header" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagen" },
  { value: "DOCUMENT", label: "Documento" },
] as const;

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

function SelectField({ id, label, value, onChange, options }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-adlive-text-main">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface CreateTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTemplateModal({ open, onClose }: CreateTemplateModalProps) {
  const { createWhatsappTemplate } = useCrm();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("MARKETING");
  const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]["value"]>("es");
  const [headerType, setHeaderType] = useState<(typeof HEADER_OPTIONS)[number]["value"]>("NONE");
  const [headerContent, setHeaderContent] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<WhatsAppTemplateButton[]>([]);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const variablesCount = countVariables(body);

  /** Inserta texto en la posición del cursor del textarea de cuerpo. */
  const insertAtCursor = (snippet: string) => {
    const textarea = bodyRef.current;
    const position = textarea ? textarea.selectionStart : body.length;
    const next = body.slice(0, position) + snippet + body.slice(position);
    setBody(next);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const caret = position + snippet.length;
        textarea.setSelectionRange(caret, caret);
      }
    });
  };

  const addVariable = () => {
    insertAtCursor(`{{${variablesCount + 1}}}`);
  };

  /** Envuelve la selección actual con el marcador de formato de WhatsApp. */
  const applyFormat = (prefix: string, suffix: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + prefix + (selected.length > 0 ? selected : "") + suffix + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = selected.length > 0 ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleClose = () => {
    setName("");
    setCategory("MARKETING");
    setLanguage("es");
    setHeaderType("NONE");
    setHeaderContent("");
    setBody("");
    setFooter("");
    setButtons([]);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!isValidTemplateName(name)) {
      setError("El nombre debe estar en formato snake_case (minúsculas, números y guiones bajos), mínimo 3 caracteres.");
      return;
    }
    if (body.trim().length === 0) {
      setError("Escribe el cuerpo del mensaje.");
      return;
    }
    if (body.length > 1024) {
      setError("El cuerpo supera el límite de 1024 caracteres.");
      return;
    }
    if (headerType === "TEXT" && headerContent.trim().length === 0) {
      setError("El header de tipo Texto necesita contenido.");
      return;
    }
    createWhatsappTemplate({
      name,
      category,
      language,
      body_text: body,
      footer_text: footer.trim() || null,
      variables_count: variablesCount,
      header_type: headerType,
      header_content: headerType === "TEXT" ? headerContent.trim() : headerType === "NONE" ? null : `${headerType.toLowerCase()}:pendiente-de-cargar`,
      buttons: sanitizeButtons(buttons),
    });
    handleClose();
  };

  const formatButtons = [
    { label: "Negrita", icon: Bold, prefix: "*", suffix: "*" },
    { label: "Cursiva", icon: Italic, prefix: "_", suffix: "_" },
    { label: "Tachado", icon: Strikethrough, prefix: "~", suffix: "~" },
    { label: "Monoespaciado", icon: Code, prefix: "```", suffix: "```" },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Crear plantilla"
      subtitle="Se enviará a Meta Cloud API para aprobación. El estado inicial será «En revisión»."
      maxWidthClassName="max-w-5xl"
    >
      <form
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        {/* ============ Columna izquierda: formulario ============ */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tpl-name" className="text-sm font-medium text-adlive-text-main">
              Nombre <span aria-hidden className="text-adlive-danger">*</span>
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="bienvenida_lead"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 font-mono text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
            <p className="text-xs text-adlive-text-muted">Formato snake_case, tal como lo exige Meta.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField id="tpl-category" label="Categoría" value={category} onChange={(value) => setCategory(value as typeof category)} options={CATEGORY_OPTIONS} />
            <SelectField id="tpl-language" label="Idioma" value={language} onChange={(value) => setLanguage(value as typeof language)} options={LANGUAGE_OPTIONS} />
          </div>

          <SelectField id="tpl-header" label="Header (opcional)" value={headerType} onChange={(value) => setHeaderType(value as typeof headerType)} options={HEADER_OPTIONS} />
          {headerType === "TEXT" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tpl-header-content" className="text-sm font-medium text-adlive-text-main">
                Texto del header
              </label>
              <input
                id="tpl-header-content"
                value={headerContent}
                onChange={(event) => setHeaderContent(event.target.value)}
                placeholder="¡Oferta especial para ti!"
                className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
              />
            </div>
          ) : null}

          {/* Cuerpo con barra de formato */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="tpl-body" className="text-sm font-medium text-adlive-text-main">
                Cuerpo del mensaje <span aria-hidden className="text-adlive-danger">*</span>
              </label>
              <div className="flex items-center gap-1" role="toolbar" aria-label="Formato del mensaje">
                {formatButtons.map((format) => (
                  <button
                    key={format.label}
                    type="button"
                    title={format.label}
                    aria-label={format.label}
                    onClick={() => applyFormat(format.prefix, format.suffix)}
                    className="rounded-lg border border-adlive-border bg-white p-1.5 text-adlive-text-muted transition-colors hover:border-adlive-primary hover:text-adlive-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-primary"
                  >
                    <format.icon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={1024}
              placeholder="Hola {{1}}, tu plan de 50GB está listo…"
              className="w-full resize-y rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
            <div className="flex items-center justify-between text-xs text-adlive-text-muted">
              <button
                type="button"
                onClick={addVariable}
                className="inline-flex items-center gap-1 rounded-lg border border-adlive-primary/30 bg-adlive-primary-light px-2 py-1 font-medium text-adlive-primary transition-colors hover:bg-adlive-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-primary"
              >
                <Plus className="h-3 w-3" aria-hidden />
                Agregar variable
              </button>
              <span aria-live="polite">
                Variables detectadas: {variablesCount} · {body.length}/1024
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tpl-footer" className="text-sm font-medium text-adlive-text-main">
              Footer (opcional)
            </label>
            <input
              id="tpl-footer"
              value={footer}
              onChange={(event) => setFooter(event.target.value.slice(0, 60))}
              placeholder="ADLIVE SAS · Portabilidad Movistar"
              className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
            <p className="text-right text-xs text-adlive-text-muted">{footer.length}/60</p>
          </div>

          {/* Botones */}
          <TemplateButtonsEditor buttons={buttons} onChange={setButtons} />
        </div>

        {/* ============ Columna derecha: vista previa ============ */}
        <div className="flex flex-col gap-3">
          <TemplatePreview headerType={headerType} headerContent={headerContent} body={body} footer={footer} buttons={buttons} />
          <p className="text-xs text-adlive-text-muted">
            La vista previa reemplaza las variables por datos de ejemplo y simula la burbuja que verá el cliente en WhatsApp.
          </p>
        </div>

        {/* Pie del formulario */}
        <div className="flex flex-col gap-3 border-t border-adlive-border pt-4 lg:col-span-2">
          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">Crear plantilla</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
