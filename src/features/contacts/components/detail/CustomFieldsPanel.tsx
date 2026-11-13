"use client";

/**
 * M3 — Acordeón `Campos personalizados`: renderiza los campos dinámicos
 * definidos para el tenant (Operador actual, NIP, Cédula…) con edición
 * por tipo (texto, número, fecha o lista desplegable). Los valores se
 * guardan en `contact.custom_fields` vía updateContact.
 */

import Link from "next/link";

import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

import { Accordion } from "./Accordion";

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

export function CustomFieldsPanel({ contact }: { contact: Contact }) {
  const { customFields, updateContact } = useCrm();

  const setFieldValue = (fieldKey: string, value: string) => {
    updateContact(contact.id, {
      custom_fields: { ...contact.custom_fields, [fieldKey]: value },
    });
  };

  if (customFields.length === 0) {
    return (
      <Accordion title="Campos personalizados" subtitle="Datos extra de portabilidad">
        <p className="text-sm leading-6 text-adlive-text-muted">
          Aún no hay campos personalizados definidos en esta cuenta.
        </p>
        <Link
          href="/contactos"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-adlive-primary underline-offset-2 hover:underline"
        >
          Crear campos personalizados desde el botón «Campos» de Contactos →
        </Link>
      </Accordion>
    );
  }

  return (
    <Accordion title="Campos personalizados" subtitle={`${customFields.length} definidos en esta cuenta`}>
      <div className="flex flex-col gap-3.5">
        {customFields.map((field) => {
          const value = contact.custom_fields[field.field_key] ?? "";
          if (field.field_type === "select") {
            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                <label htmlFor={`cf-${field.field_key}`} className="text-sm font-medium text-adlive-text-main">
                  {field.field_label}
                </label>
                <select
                  id={`cf-${field.field_key}`}
                  value={value}
                  onChange={(event) => setFieldValue(field.field_key, event.target.value)}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  <option value="">Sin valor</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={`cf-${field.field_key}`} className="text-sm font-medium text-adlive-text-main">
                {field.field_label}
              </label>
              <input
                id={`cf-${field.field_key}`}
                type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"}
                value={value}
                onChange={(event) => setFieldValue(field.field_key, event.target.value)}
                placeholder="Sin valor"
                className={INPUT_CLASS}
              />
            </div>
          );
        })}
      </div>
    </Accordion>
  );
}
