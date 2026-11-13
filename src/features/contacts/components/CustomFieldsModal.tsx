"use client";

/**
 * M3 — Modal `Campos`: gestión de campos personalizados del tenant
 * (Operador actual, NIP, Cédula, Dirección de envío de la SIM…).
 * Lista las definiciones existentes, permite crear (texto, número,
 * select con opciones, fecha) y eliminar.
 */

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { CustomFieldType } from "@/shared/types/database";

import { Modal } from "./Modal";

export interface CustomFieldsModalProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: Array<{ value: CustomFieldType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Lista desplegable" },
  { value: "date", label: "Fecha" },
];

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  select: "Lista desplegable",
  date: "Fecha",
};

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function CustomFieldsModal({ open, onClose }: CustomFieldsModalProps) {
  const { customFields, addCustomField, deleteCustomField } = useCrm();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLabel("");
    setFieldType("text");
    setOptions("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (trimmedLabel.length < 2) {
      setError("Escribe el nombre del campo (mínimo 2 caracteres).");
      return;
    }
    const fieldKey = toFieldKey(trimmedLabel);
    if (!fieldKey) {
      setError("El nombre del campo debe generar una clave válida.");
      return;
    }
    if (customFields.some((field) => field.field_key === fieldKey)) {
      setError(`Ya existe un campo con la clave «${fieldKey}».`);
      return;
    }
    const parsedOptions = fieldType === "select"
      ? options
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean)
      : [];
    if (fieldType === "select" && parsedOptions.length < 2) {
      setError("Una lista desplegable necesita al menos 2 opciones separadas por coma.");
      return;
    }
    addCustomField({ field_key: fieldKey, field_label: trimmedLabel, field_type: fieldType, options: parsedOptions });
    resetForm();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Campos personalizados"
      subtitle="Definen los datos extra de portabilidad (Operador, NIP, Cédula…) que se editan en cada ficha."
      maxWidthClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-adlive-text-main">
            Campos existentes <span className="text-adlive-text-muted">({customFields.length})</span>
          </p>
          {customFields.length > 0 ? (
            <ul className="flex flex-col divide-y divide-adlive-border rounded-xl border border-adlive-border">
              {customFields.map((field) => (
                <li key={field.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-adlive-text-main">{field.field_label}</p>
                    <p className="truncate font-mono text-xs text-adlive-text-muted">{field.field_key}</p>
                  </div>
                  <Badge tone="neutral">{TYPE_LABELS[field.field_type]}</Badge>
                  {field.options.length > 0 ? (
                    <Badge tone="cyan">{field.options.length} opciones</Badge>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => deleteCustomField(field.id)}
                    aria-label={`Eliminar campo ${field.field_label}`}
                    className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-red-50 hover:text-adlive-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-adlive-border px-4 py-6 text-center text-sm text-adlive-text-muted">
              Todavía no hay campos personalizados. Crea el primero con el formulario de abajo.
            </p>
          )}
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-xl border border-adlive-border bg-adlive-canvas-bg/40 p-4">
          <p className="text-sm font-semibold text-adlive-text-main">Crear campo</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nombre del campo"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej: Operador Donante"
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="campo-tipo" className="text-sm font-medium text-adlive-text-main">
                Tipo
              </label>
              <select id="campo-tipo" value={fieldType} onChange={(event) => setFieldType(event.target.value as CustomFieldType)} className={INPUT_CLASS}>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {fieldType === "select" ? (
            <Input
              label="Opciones (separadas por coma)"
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              placeholder="Claro, Movistar, Tigo, WOM"
            />
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="sm" className="self-start">
            Agregar campo
          </Button>
        </form>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
