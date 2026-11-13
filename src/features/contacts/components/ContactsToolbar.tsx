"use client";

/**
 * M3 — Barra de acciones superior de Contactos:
 * Campos · Importar · Exportar · Exportar reporte de respuestas · Columnas
 * y botón primario `+ Nuevo contacto`. El dropdown Columnas permite
 * mostrar/ocultar columnas de la tabla.
 */

import { Columns3, Download, FileSpreadsheet, FileText, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/Button";

import { CONTACTS_COLUMN_LABELS, type ContactsColumnKey } from "./contactsUtils";

export interface ContactsToolbarProps {
  onOpenFields: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onExportResponses: () => void;
  onOpenNew: () => void;
  hiddenColumns: ContactsColumnKey[];
  onToggleColumn: (column: ContactsColumnKey) => void;
}

const TOOLBAR_BUTTON_CLASS =
  "h-9 gap-1.5 rounded-xl border border-adlive-border bg-white px-3 text-sm font-medium text-adlive-text-main shadow-none transition-colors hover:bg-adlive-canvas-bg";

export function ContactsToolbar({
  onOpenFields,
  onOpenImport,
  onExport,
  onExportResponses,
  onOpenNew,
  hiddenColumns,
  onToggleColumn,
}: ContactsToolbarProps) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  /* Cerrar el dropdown Columnas al hacer clic fuera (patrón declarativo). */
  useEffect(() => {
    if (!columnsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Acciones de contactos">
      <Button variant="secondary" size="sm" onClick={onOpenFields} className={TOOLBAR_BUTTON_CLASS}>
        <SlidersHorizontal className="h-4 w-4 text-adlive-primary" aria-hidden />
        Campos
      </Button>
      <Button variant="secondary" size="sm" onClick={onOpenImport} className={TOOLBAR_BUTTON_CLASS}>
        <FileSpreadsheet className="h-4 w-4 text-adlive-primary" aria-hidden />
        Importar
      </Button>
      <Button variant="secondary" size="sm" onClick={onExport} className={TOOLBAR_BUTTON_CLASS}>
        <Download className="h-4 w-4 text-adlive-primary" aria-hidden />
        Exportar
      </Button>
      <Button variant="secondary" size="sm" onClick={onExportResponses} className={TOOLBAR_BUTTON_CLASS}>
        <FileText className="h-4 w-4 text-adlive-primary" aria-hidden />
        Exportar reporte de respuestas
      </Button>

      <div className="relative" ref={columnsRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setColumnsOpen((open) => !open)}
          aria-expanded={columnsOpen}
          aria-haspopup="true"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Columns3 className="h-4 w-4 text-adlive-primary" aria-hidden />
          Columnas
        </Button>
        {columnsOpen ? (
          <div
            role="menu"
            aria-label="Mostrar u ocultar columnas"
            className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-adlive-border bg-white p-2 shadow-card"
          >
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">
              Visibilidad de columnas
            </p>
            {(Object.keys(CONTACTS_COLUMN_LABELS) as ContactsColumnKey[]).map((column) => {
              const visible = !hiddenColumns.includes(column);
              return (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-adlive-text-main transition-colors hover:bg-adlive-canvas-bg"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggleColumn(column)}
                    className="h-4 w-4 cursor-pointer rounded border-adlive-border accent-[#5b00ff]"
                  />
                  {CONTACTS_COLUMN_LABELS[column]}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      <Button variant="primary" size="sm" onClick={onOpenNew} className="ml-auto h-9 gap-1.5">
        <Plus className="h-4 w-4" aria-hidden />
        Nuevo contacto
      </Button>
    </div>
  );
}
