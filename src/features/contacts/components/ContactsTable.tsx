"use client";

/**
 * M3 — Tabla de Contactos: selección múltiple, columnas configurables
 * (Teléfono en JetBrains Mono, Etiquetas como badges, Cliente cerrado Sí/No)
 * y eliminación con confirmación en dos pasos integrada en la fila.
 */

import { Check, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import type { Contact } from "@/shared/types/database";
import { formatDate, formatRelativeTime } from "@/shared/lib/format";

import { formatPhone, type ContactsColumnKey } from "./contactsUtils";

export interface ContactsTableProps {
  contacts: Contact[];
  hiddenColumns: ContactsColumnKey[];
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (contactId: string) => void;
  onToggleSelectAll: () => void;
  onDelete: (contactId: string) => void;
}

function isVisible(hiddenColumns: ContactsColumnKey[], column: ContactsColumnKey): boolean {
  return !hiddenColumns.includes(column);
}

export function ContactsTable({
  contacts,
  hiddenColumns,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: ContactsTableProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const allSelected = contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Tabla de contactos con nombre, teléfono, email, empresa, etiquetas, fuente y actividad
          </caption>
          <thead>
            <tr className="border-b border-adlive-border bg-adlive-canvas-bg/60 text-xs uppercase tracking-wide text-adlive-text-muted">
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Seleccionar todos los contactos filtrados"
                  className="h-4 w-4 cursor-pointer rounded border-adlive-border accent-[#5b00ff]"
                />
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Nombre
              </th>
              {isVisible(hiddenColumns, "phone") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Teléfono
                </th>
              ) : null}
              {isVisible(hiddenColumns, "email") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Email
                </th>
              ) : null}
              {isVisible(hiddenColumns, "company") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Negocio / Empresa
                </th>
              ) : null}
              {isVisible(hiddenColumns, "tags") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Etiquetas
                </th>
              ) : null}
              {isVisible(hiddenColumns, "source") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Fuente
                </th>
              ) : null}
              {isVisible(hiddenColumns, "created") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Creado
                </th>
              ) : null}
              {isVisible(hiddenColumns, "lastActivity") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Última actividad
                </th>
              ) : null}
              {isVisible(hiddenColumns, "closedClient") ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Cliente cerrado
                </th>
              ) : null}
              <th scope="col" className="w-16 px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const isSelected = selectedIds.has(contact.id);
              const isConfirming = confirmingId === contact.id;
              return (
                <tr
                  key={contact.id}
                  className={`border-b border-adlive-border/70 transition-colors last:border-0 ${
                    isSelected ? "bg-adlive-primary-light/50" : "hover:bg-adlive-canvas-bg/50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(contact.id)}
                      aria-label={`Seleccionar a ${contact.full_name}`}
                      className="h-4 w-4 cursor-pointer rounded border-adlive-border accent-[#5b00ff]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contactos/${contact.id}`}
                      className="font-semibold text-adlive-primary underline-offset-2 transition-colors hover:text-adlive-primary-hover hover:underline"
                    >
                      {contact.full_name}
                    </Link>
                  </td>
                  {isVisible(hiddenColumns, "phone") ? (
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] text-adlive-text-main">{formatPhone(contact.phone_e164)}</span>
                    </td>
                  ) : null}
                  {isVisible(hiddenColumns, "email") ? (
                    <td className="px-4 py-3 text-adlive-text-muted">{contact.email ?? "—"}</td>
                  ) : null}
                  {isVisible(hiddenColumns, "company") ? (
                    <td className="px-4 py-3 text-adlive-text-muted">{contact.company_name ?? "—"}</td>
                  ) : null}
                  {isVisible(hiddenColumns, "tags") ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0 ? (
                          contact.tags.map((tag) => (
                            <Badge key={tag} tone="primary">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-adlive-text-muted">—</span>
                        )}
                      </div>
                    </td>
                  ) : null}
                  {isVisible(hiddenColumns, "source") ? (
                    <td className="px-4 py-3">
                      <Badge tone="cyan">{contact.lead_source}</Badge>
                    </td>
                  ) : null}
                  {isVisible(hiddenColumns, "created") ? (
                    <td className="px-4 py-3 text-adlive-text-muted">{formatDate(contact.created_at)}</td>
                  ) : null}
                  {isVisible(hiddenColumns, "lastActivity") ? (
                    <td className="px-4 py-3 text-adlive-text-muted">
                      {contact.last_interaction_at ? formatRelativeTime(contact.last_interaction_at) : "—"}
                    </td>
                  ) : null}
                  {isVisible(hiddenColumns, "closedClient") ? (
                    <td className="px-4 py-3">
                      <Badge tone={contact.is_closed_client ? "success" : "neutral"}>
                        {contact.is_closed_client ? "Sí" : "No"}
                      </Badge>
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    {isConfirming ? (
                      <div className="flex items-center gap-1" role="group" aria-label={`Confirmar eliminación de ${contact.full_name}`}>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(contact.id);
                            setConfirmingId(null);
                          }}
                          aria-label={`Confirmar eliminar a ${contact.full_name}`}
                          className="cursor-pointer rounded-lg bg-adlive-danger p-1.5 text-white transition-colors hover:bg-red-600"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          aria-label="Cancelar eliminación"
                          className="cursor-pointer rounded-lg border border-adlive-border bg-white p-1.5 text-adlive-text-muted transition-colors hover:bg-adlive-canvas-bg"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(contact.id)}
                        aria-label={`Eliminar a ${contact.full_name}`}
                        className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-red-50 hover:text-adlive-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-adlive-text-muted">
                  No hay contactos que coincidan con los filtros aplicados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
