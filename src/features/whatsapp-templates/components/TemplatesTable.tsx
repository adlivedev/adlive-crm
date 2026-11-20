"use client";

/**
 * Tabla de Plantillas de WhatsApp Business (M7): nombre, extracto del cuerpo,
 * motivo, categoría, idioma, variables, badge de estado y eliminación en dos
 * pasos. Datos 100% del store reactivo.
 */

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import type { WhatsAppTemplate } from "@/shared/types/database";

import { bodyExcerpt, statusMeta } from "./templateUtils";

export interface TemplatesTableProps {
  templates: WhatsAppTemplate[];
  onDelete: (templateId: string) => void;
  readOnly?: boolean;
}

export function TemplatesTable({ templates, onDelete, readOnly = false }: TemplatesTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (templates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-adlive-border bg-white px-6 py-10 text-center text-sm text-adlive-text-muted">
        {readOnly ? "No hay plantillas disponibles para este workspace." : "No hay plantillas registradas. Sincroniza con Meta Cloud API o crea la primera con «Crear plantilla»."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-adlive-border bg-white shadow-card">
      <table className="w-full min-w-[860px] text-left text-sm">
        <caption className="sr-only">Plantillas de WhatsApp Business de la cuenta conectada</caption>
        <thead>
          <tr className="border-b border-adlive-border text-xs uppercase tracking-wide text-adlive-text-muted">
            <th scope="col" className="px-5 py-3 font-semibold">Nombre</th>
            <th scope="col" className="px-5 py-3 font-semibold">Mensaje</th>
            <th scope="col" className="px-5 py-3 font-semibold">Motivo</th>
            <th scope="col" className="px-5 py-3 font-semibold">Categoría</th>
            <th scope="col" className="px-5 py-3 font-semibold">Idioma</th>
            <th scope="col" className="px-5 py-3 text-center font-semibold">Variables</th>
            <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => {
            const status = statusMeta(template.status);
            const confirming = confirmId === template.id;
            return (
              <tr key={template.id} className="border-b border-adlive-border/60 transition-colors last:border-0 hover:bg-adlive-canvas-bg/50">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-adlive-primary">{template.name}</td>
                <td className="max-w-72 px-5 py-3.5">
                  <p className="truncate text-xs text-adlive-text-muted" title={template.body_text}>
                    {bodyExcerpt(template.body_text)}
                  </p>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-adlive-text-muted">{template.rejection_reason}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={template.category === "MARKETING" ? "primary" : template.category === "UTILITY" ? "cyan" : "warning"}>
                    {template.category}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-xs text-adlive-text-main">{template.language}</td>
                <td className="px-5 py-3.5 text-center font-mono text-xs text-adlive-text-main">{template.variables_count}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {readOnly ? <span className="text-xs text-adlive-text-muted">Solo lectura</span> : confirming ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(template.id);
                          setConfirmId(null);
                        }}
                        className="rounded-lg bg-adlive-danger px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-danger"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-adlive-border px-2.5 py-1 text-xs font-medium text-adlive-text-muted transition-colors hover:bg-adlive-canvas-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-primary"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Eliminar plantilla ${template.name}`}
                      title="Eliminar plantilla"
                      onClick={() => setConfirmId(template.id)}
                      className="rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-red-50 hover:text-adlive-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
