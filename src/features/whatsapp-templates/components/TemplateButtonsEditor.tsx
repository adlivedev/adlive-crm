"use client";

/**
 * Editor de botones de plantilla (M7): respuestas rápidas o botones URL
 * (máx. 3, como exige Meta), con plantilla rápida Sí / No.
 */

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/Button";
import type { WhatsAppTemplateButton } from "@/shared/types/database";

import { BUTTON_TYPE_OPTIONS, defaultQuickReplyButtons } from "./templateUtils";

export interface TemplateButtonsEditorProps {
  buttons: WhatsAppTemplateButton[];
  onChange: (buttons: WhatsAppTemplateButton[]) => void;
}

export function TemplateButtonsEditor({ buttons, onChange }: TemplateButtonsEditorProps) {
  const updateButton = (index: number, patch: Partial<WhatsAppTemplateButton>) => {
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)));
  };

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-adlive-border p-3">
      <legend className="px-1 text-sm font-medium text-adlive-text-main">Botones (opcional)</legend>
      {buttons.length === 0 ? (
        <p className="text-xs text-adlive-text-muted">Sin botones. Puedes agregar respuestas rápidas o enlaces.</p>
      ) : (
        buttons.map((button, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Tipo del botón ${index + 1}`}
              value={button.type}
              onChange={(event) => updateButton(index, { type: event.target.value as WhatsAppTemplateButton["type"] })}
              className="h-9 cursor-pointer rounded-lg border border-adlive-border bg-white px-2 text-xs focus:border-adlive-primary focus:outline-none"
            >
              {BUTTON_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              aria-label={`Texto del botón ${index + 1}`}
              value={button.text}
              onChange={(event) => updateButton(index, { text: event.target.value.slice(0, 25) })}
              placeholder="Sí"
              className="h-9 flex-1 rounded-lg border border-adlive-border bg-white px-3 text-xs focus:border-adlive-primary focus:outline-none"
            />
            {button.type === "URL" ? (
              <input
                aria-label={`URL del botón ${index + 1}`}
                value={button.url ?? ""}
                onChange={(event) => updateButton(index, { url: event.target.value })}
                placeholder="https://…"
                className="h-9 min-w-32 flex-1 rounded-lg border border-adlive-border bg-white px-3 font-mono text-xs focus:border-adlive-primary focus:outline-none"
              />
            ) : null}
            <button
              type="button"
              aria-label={`Eliminar botón ${index + 1}`}
              onClick={() => onChange(buttons.filter((_, i) => i !== index))}
              className="rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-red-50 hover:text-adlive-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-danger"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={buttons.length >= 3}
          onClick={() => onChange([...buttons, { type: "QUICK_REPLY", text: "" }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Agregar botón
        </Button>
        {buttons.length === 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(defaultQuickReplyButtons())}>
            Plantilla Sí / No
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}
