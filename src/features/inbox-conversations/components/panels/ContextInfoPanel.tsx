"use client";

/**
 * M5 — Pestaña «Info Contacto»: identidad, etiquetas editables, bloque de
 * datos y campos personalizados de portabilidad con búsqueda y edición en vivo.
 */

import { ExternalLink, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { formatDate, initials } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

import { normalizeText } from "../inboxUtils";

export function ContextInfoPanel({ contact }: { contact: Contact }) {
  const { updateContact, customFields } = useCrm();
  const [tagInput, setTagInput] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || contact.tags.includes(tag)) return;
    updateContact(contact.id, { tags: [...contact.tags, tag] });
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    updateContact(contact.id, { tags: contact.tags.filter((current) => current !== tag) });
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    updateContact(contact.id, { custom_fields: { ...contact.custom_fields, [fieldKey]: value } });
  };

  const search = normalizeText(fieldSearch.trim());
  const visibleFields = useMemo(
    () => customFields.filter((field) => !search || normalizeText(field.field_label).includes(search) || normalizeText(field.field_key).includes(search)),
    [customFields, search],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Identidad */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-adlive-primary text-xl font-bold text-adlive-text-inverse"
        >
          {initials(contact.full_name)}
        </span>
        <h3 className="text-sm font-bold text-adlive-text-main">{contact.full_name}</h3>
        <p className="font-mono text-xs text-adlive-text-muted">{contact.phone_e164}</p>
        {contact.email ? <p className="break-all text-xs text-adlive-text-muted">{contact.email}</p> : null}

        {/* Etiquetas editables */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {contact.tags.map((tag) => (
            <Badge key={tag} tone="primary">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Eliminar etiqueta ${tag}`}
                className="cursor-pointer rounded-full p-0.5 hover:bg-adlive-primary/20"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <span className="flex items-center gap-1">
            <label htmlFor="ctx-tag-input" className="sr-only">
              Agregar etiqueta
            </label>
            <input
              id="ctx-tag-input"
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAddTag();
              }}
              placeholder="+ agregar etiqueta"
              className="h-7 w-28 rounded-full border border-dashed border-adlive-border px-2 text-[11px] text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              aria-label="Agregar etiqueta"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-adlive-primary text-white transition-colors hover:bg-adlive-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        </div>
      </div>

      {/* Info del contacto */}
      <div className="rounded-xl border border-adlive-border">
        <h4 className="border-b border-adlive-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-adlive-text-muted">
          Info del contacto
        </h4>
        <dl className="divide-y divide-adlive-border text-xs">
          <InfoRow label="Nombre" value={contact.full_name} />
          <InfoRow label="Teléfono" value={contact.phone_e164} mono />
          <InfoRow label="Email" value={contact.email ?? "—"} />
          <InfoRow label="Empresa" value={contact.company_name ?? "—"} />
          <InfoRow label="Fuente" value={`${contact.lead_source} · Base 23 Oct`} />
          <InfoRow label="Creado el" value={formatDate(contact.created_at)} />
        </dl>
      </div>

      {/* Campos personalizados con búsqueda y edición en vivo */}
      <div className="rounded-xl border border-adlive-border">
        <div className="border-b border-adlive-border p-2.5">
          <label htmlFor="ctx-field-search" className="sr-only">
            Buscar campos
          </label>
          <input
            id="ctx-field-search"
            type="search"
            value={fieldSearch}
            onChange={(event) => setFieldSearch(event.target.value)}
            placeholder="Buscar campos"
            className="h-8 w-full rounded-lg border border-adlive-border bg-adlive-canvas-bg/60 px-2.5 text-xs text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        </div>
        {visibleFields.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-adlive-text-muted">No hay campos que coincidan con la búsqueda.</p>
        ) : (
          <ul className="divide-y divide-adlive-border">
            {visibleFields.map((field) => (
              <li key={field.id} className="flex flex-col gap-1 px-3 py-2">
                <label htmlFor={`ctx-field-${field.field_key}`} className="text-[11px] font-medium text-adlive-text-muted">
                  {field.field_label}
                </label>
                <input
                  id={`ctx-field-${field.field_key}`}
                  type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                  value={contact.custom_fields[field.field_key] ?? ""}
                  onChange={(event) => handleFieldChange(field.field_key, event.target.value)}
                  className="h-8 rounded-lg border border-adlive-border bg-white px-2.5 text-xs text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={`/contactos/${contact.id}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-adlive-primary/30 bg-adlive-primary-light px-3 py-2.5 text-xs font-bold text-adlive-primary transition-colors hover:bg-adlive-primary hover:text-adlive-text-inverse"
      >
        Abrir ficha completa
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 font-medium text-adlive-text-muted">{label}</dt>
      <dd className={`truncate text-right text-adlive-text-main ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
