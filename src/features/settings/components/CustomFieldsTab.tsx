"use client";

import { Check, LockKeyhole, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { CustomFieldDefinition, CustomFieldType } from "@/shared/types/database";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto",
  textarea: "Área de texto",
  name: "Apellido/Nombre",
  phone: "Teléfono (+57)",
  email: "Correo",
  number: "Número",
  select: "Selección (Dropdown)",
  checkbox: "Casilla (Checkbox)",
  radio: "Opción única (Radio)",
  date: "Fecha",
  html: "Bloque de texto/HTML",
};
/** Tipos que usan la lista de opciones (dropdown, radio). */
const OPTION_TYPES: CustomFieldType[] = ["select", "radio"];
const BASE_FIELDS = [
  { name: "Nombre", key: "first_name", description: "Nombre de pila del contacto" },
  { name: "Apellido", key: "last_name", description: "Se combina con el nombre" },
  { name: "Teléfono", key: "phone", description: "Con código de país" },
  { name: "Correo electrónico", key: "email", description: "Dato de contacto opcional" },
  { name: "Atribución de Campaña", key: "utm_* / fbclid", description: "UTM, URL y referencia automáticas" },
];
const RESERVED_KEYS = new Set(["first_name", "last_name", "full_name", "phone", "phone_e164", "email"]);

export function slugifyFieldKey(label: string): string {
  return label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function CustomFieldsTab() {
  const { customFields, addCustomField, updateCustomField, deleteCustomField } = useCrm();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<CustomFieldType>("text");
  const [editOptions, setEditOptions] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const slug = slugifyFieldKey(label);
  const keyTaken = customFields.some((field) => field.field_key === slug) || RESERVED_KEYS.has(slug);
  const isValid = label.trim().length >= 2 && slug.length > 0 && !keyTaken;

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    addCustomField({ field_key: slug, field_label: label.trim(), field_type: fieldType, options: OPTION_TYPES.includes(fieldType) ? options.split(",").map((option) => option.trim()).filter(Boolean) : [] });
    setAnnouncement(`Campo «${label.trim()}» creado. Ya aparece en las landings y formularios.`);
    setLabel(""); setFieldType("text"); setOptions("");
  }

  function startEdit(field: CustomFieldDefinition) {
    setEditingId(field.id); setEditLabel(field.field_label); setEditType(field.field_type); setEditOptions(field.options.join(", ")); setPendingDeleteId(null);
  }

  function saveEdit(field: CustomFieldDefinition) {
    if (editLabel.trim().length < 2) return;
    updateCustomField(field.id, { field_label: editLabel.trim(), field_type: editType, options: OPTION_TYPES.includes(editType) ? editOptions.split(",").map((option) => option.trim()).filter(Boolean) : [] });
    setAnnouncement(`Campo «${editLabel.trim()}» actualizado. La clave ${field.field_key} se conservó.`);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-adlive-text-main">Campos Base del Sistema</h3><p className="mt-1 text-xs text-adlive-text-muted">Activos por defecto en todas las landings y formularios del workspace.</p></div><Badge tone="success"><LockKeyhole className="mr-1 h-3.5 w-3.5" aria-hidden />Siempre activos</Badge></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{BASE_FIELDS.map((field) => <div key={field.key} className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-adlive-text-main">{field.name}</span><Check className="h-4 w-4 shrink-0 text-adlive-success" aria-label="Activo" /></div><p className="mt-1 text-xs leading-5 text-adlive-text-muted">{field.description}</p><code className="mt-2 block truncate text-[11px] text-adlive-text-muted">{field.key}</code></div>)}</div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-adlive-text-main">Nuevo campo personalizado</h3>
        <p className="mt-1 text-xs text-adlive-text-muted">Se renderiza automáticamente después de los campos base. Ejemplos: Operador actual, Ciudad o Plan de interés.</p>
        <form onSubmit={create} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Nombre del campo" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ej. Operador actual" />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-adlive-text-main">Tipo<select value={fieldType} onChange={(event) => setFieldType(event.target.value as CustomFieldType)} className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm outline-none focus:border-adlive-primary focus:ring-2 focus:ring-adlive-primary/20">{(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label>
          {OPTION_TYPES.includes(fieldType) ? <Input label="Opciones (separadas por coma)" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Claro, Tigo, WOM" /> : <div className="hidden xl:block" />}
          <div className="flex items-end"><Button type="submit" disabled={!isValid} className="w-full"><Plus className="h-4 w-4" aria-hidden />Crear campo</Button></div>
          {slug ? <p className={`text-xs md:col-span-2 xl:col-span-4 ${keyTaken ? "text-adlive-danger" : "text-adlive-text-muted"}`}>Clave: <code>{slug}</code>{keyTaken ? " · ya existe o pertenece a un campo base" : ""}</p> : null}
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-adlive-border bg-adlive-canvas-bg text-xs uppercase tracking-wide text-adlive-text-muted"><th scope="col" className="px-6 py-3 font-semibold">Campo</th><th scope="col" className="px-4 py-3 font-semibold">Clave</th><th scope="col" className="px-4 py-3 font-semibold">Tipo</th><th scope="col" className="px-4 py-3 font-semibold">Opciones</th><th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody className="divide-y divide-adlive-border">{customFields.map((field) => {
            const editing = editingId === field.id;
            return <tr key={field.id} className="transition-colors hover:bg-adlive-canvas-bg/60">
              <td className="px-6 py-3.5 font-medium text-adlive-text-main">{editing ? <input aria-label={`Editar nombre de ${field.field_label}`} value={editLabel} onChange={(event) => setEditLabel(event.target.value)} className="h-10 w-full rounded-lg border border-adlive-border px-3 outline-none focus:border-adlive-primary" /> : field.field_label}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-adlive-text-muted">{field.field_key}</td>
              <td className="px-4 py-3.5">{editing ? <select aria-label="Editar tipo" value={editType} onChange={(event) => setEditType(event.target.value as CustomFieldType)} className="h-10 rounded-lg border border-adlive-border bg-white px-2 text-xs">{(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select> : <Badge tone="neutral">{TYPE_LABELS[field.field_type]}</Badge>}</td>
              <td className="px-4 py-3.5 text-xs text-adlive-text-muted">{editing && OPTION_TYPES.includes(editType) ? <input aria-label="Editar opciones" value={editOptions} onChange={(event) => setEditOptions(event.target.value)} className="h-10 w-full rounded-lg border border-adlive-border px-3 outline-none focus:border-adlive-primary" /> : editing ? "—" : field.options.length ? field.options.join(", ") : "—"}</td>
              <td className="px-4 py-3.5"><div className="flex justify-end gap-1">{editing ? <><Button size="sm" variant="ghost" aria-label="Guardar campo" onClick={() => saveEdit(field)} disabled={editLabel.trim().length < 2}><Check className="h-4 w-4 text-adlive-success" aria-hidden /></Button><Button size="sm" variant="ghost" aria-label="Cancelar edición" onClick={() => setEditingId(null)}><X className="h-4 w-4" aria-hidden /></Button></> : <><Button size="sm" variant="ghost" aria-label={`Editar campo ${field.field_label}`} onClick={() => startEdit(field)}><Pencil className="h-4 w-4" aria-hidden /></Button><Button size="sm" variant="ghost" aria-label={pendingDeleteId === field.id ? `Confirmar eliminación de ${field.field_label}` : `Eliminar campo ${field.field_label}`} className={pendingDeleteId === field.id ? "text-adlive-danger" : "text-adlive-text-muted"} onClick={() => { if (pendingDeleteId !== field.id) { setPendingDeleteId(field.id); return; } deleteCustomField(field.id); setPendingDeleteId(null); setAnnouncement(`Campo «${field.field_label}» eliminado.`); }} onBlur={() => setPendingDeleteId((previous) => previous === field.id ? null : previous)}><Trash2 className="h-4 w-4" aria-hidden />{pendingDeleteId === field.id ? "Confirmar" : ""}</Button></>}</div></td>
            </tr>;
          })}</tbody>
        </table>
      </Card>
    </div>
  );
}
