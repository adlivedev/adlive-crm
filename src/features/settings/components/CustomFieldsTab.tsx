"use client";

/**
 * M12 — Pestaña Campos personalizados: CRUD completo de campos de contacto.
 */

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { CustomFieldType } from "@/shared/types/database";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  select: "Lista desplegable",
  date: "Fecha",
};

/** "Cédula de ciudadanía" → "cedula_de_ciudadania" */
export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function CustomFieldsTab() {
  const { customFields, addCustomField, deleteCustomField } = useCrm();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const slug = slugifyFieldKey(label);
  const keyTaken = customFields.some((field) => field.field_key === slug);
  const isValid = label.trim().length >= 2 && slug.length > 0 && !keyTaken;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    addCustomField({
      field_key: slug,
      field_label: label.trim(),
      field_type: fieldType,
      options: fieldType === "select" ? options.split(",").map((option) => option.trim()).filter(Boolean) : [],
    });
    setAnnouncement(`Campo «${label.trim()}» creado con clave ${slug}.`);
    setLabel("");
    setFieldType("text");
    setOptions("");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-adlive-text-main">Nuevo campo personalizado</h3>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Nombre del campo" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ej. Operador actual" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-field-type" className="text-sm font-medium text-adlive-text-main">Tipo</label>
            <select
              id="custom-field-type"
              value={fieldType}
              onChange={(event) => setFieldType(event.target.value as CustomFieldType)}
              className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            >
              {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          {fieldType === "select" ? (
            <Input label="Opciones (separadas por coma)" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Claro, Tigo, WOM" />
          ) : (
            <div className="hidden xl:block" />
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={!isValid} className="w-full">
              <Plus className="h-4 w-4" aria-hidden />
              Crear campo
            </Button>
          </div>
          {slug ? (
            <p className={`text-xs md:col-span-2 xl:col-span-4 ${keyTaken ? "text-adlive-danger" : "text-adlive-text-muted"}`}>
              Clave del campo: <span className="font-mono">{slug || "—"}</span>
              {keyTaken ? " · ya existe un campo con esta clave" : ""}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-adlive-border bg-adlive-canvas-bg text-xs uppercase tracking-wide text-adlive-text-muted">
              <th scope="col" className="px-6 py-3 font-semibold">Campo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Clave</th>
              <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Opciones</th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-adlive-border">
            {customFields.map((field) => (
              <tr key={field.id} className="transition-colors hover:bg-adlive-canvas-bg/60">
                <td className="px-6 py-3.5 font-medium text-adlive-text-main">{field.field_label}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-adlive-text-muted">{field.field_key}</td>
                <td className="px-4 py-3.5"><Badge tone="neutral">{TYPE_LABELS[field.field_type]}</Badge></td>
                <td className="px-4 py-3.5 text-xs text-adlive-text-muted">{field.options.length > 0 ? field.options.join(", ") : "—"}</td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={pendingDeleteId === field.id ? `Confirmar eliminación de ${field.field_label}` : `Eliminar campo ${field.field_label}`}
                    className={pendingDeleteId === field.id ? "text-adlive-danger" : "text-adlive-text-muted"}
                    onClick={() => {
                      if (pendingDeleteId !== field.id) {
                        setPendingDeleteId(field.id);
                        return;
                      }
                      deleteCustomField(field.id);
                      setPendingDeleteId(null);
                      setAnnouncement(`Campo «${field.field_label}» eliminado.`);
                    }}
                    onBlur={() => setPendingDeleteId((prev) => (prev === field.id ? null : prev))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {pendingDeleteId === field.id ? "Confirmar" : ""}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
