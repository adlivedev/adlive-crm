"use client";

/**
 * M3 — Vista principal de Contactos (`/contactos`).
 *
 * Orquesta la barra de acciones (Campos/Importar/Exportar/Exportar reporte/
 * Columnas/Nuevo contacto), la barra de filtros completa con búsqueda
 * instantánea (debounce 300 ms) y la tabla con selección múltiple,
 * columnas configurables y eliminación con confirmación.
 */

import { useMemo, useState } from "react";

import { formatNumber } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

import { ContactsFiltersBar, type FilterOptions } from "./ContactsFilters";
import { ContactsTable } from "./ContactsTable";
import { ContactsToolbar } from "./ContactsToolbar";
import { CustomFieldsModal } from "./CustomFieldsModal";
import { ImportContactsModal } from "./ImportContactsModal";
import { NewContactModal } from "./NewContactModal";
import { useDebouncedValue } from "./useDebouncedValue";
import {
  EMPTY_CONTACTS_FILTERS,
  buildContactsCsv,
  buildResponsesCsv,
  downloadCsvFile,
  filterContacts,
  type ContactsColumnKey,
  type ContactsFilters,
} from "./contactsUtils";

type ActiveModal = "new" | "import" | "fields" | null;

export function ContactsView() {
  const { contacts, opportunities, conversations, pipelines, pipelineStages, activeTenant, deleteContact } = useCrm();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [filters, setFilters] = useState<Omit<ContactsFilters, "search">>(EMPTY_CONTACTS_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<ContactsColumnKey[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const filtersWithSearch = useMemo<ContactsFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const filterOptions = useMemo<FilterOptions>(() => {
    const tags = [...new Set(contacts.flatMap((contact) => contact.tags))].sort();
    const sources = [...new Set(contacts.map((contact) => contact.lead_source))].sort();
    return { tags, sources, pipelines, stages: pipelineStages };
  }, [contacts, pipelines, pipelineStages]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, opportunities, filtersWithSearch),
    [contacts, opportunities, filtersWithSearch],
  );

  const toggleColumn = (column: ContactsColumnKey) => {
    setHiddenColumns((previous) =>
      previous.includes(column) ? previous.filter((item) => item !== column) : [...previous, column],
    );
  };

  const toggleSelect = (contactId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((previous) => {
      const allSelected = filteredContacts.length > 0 && filteredContacts.every((contact) => previous.has(contact.id));
      return allSelected ? new Set<string>() : new Set(filteredContacts.map((contact) => contact.id));
    });
  };

  const handleDelete = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    /* Limpiar la selección si el contacto eliminado estaba marcado. */
    setSelectedIds((previous) => {
      if (!previous.has(contactId)) return previous;
      const next = new Set(previous);
      next.delete(contactId);
      return next;
    });
    deleteContact(contactId);
  };

  const handleExport = () => {
    const csv = buildContactsCsv(filteredContacts);
    downloadCsvFile(`contactos-${activeTenant?.slug ?? "adlive"}.csv`, csv);
  };

  const handleExportResponses = () => {
    const filteredIds = new Set(filteredContacts.map((contact) => contact.id));
    const filteredConversations = conversations.filter((conversation) => filteredIds.has(conversation.contact_id));
    const csv = buildResponsesCsv(filteredConversations, filteredContacts);
    downloadCsvFile(`reporte-respuestas-${activeTenant?.slug ?? "adlive"}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="sr-only" aria-live="polite">
        Mostrando {filteredContacts.length} de {contacts.length} contactos de la cuenta {activeTenant?.name ?? ""}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-adlive-text-main">Contactos</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">
            {formatNumber(filteredContacts.length)} de {formatNumber(contacts.length)} contactos · Base de leads de la
            cuenta activa
          </p>
        </div>
        <ContactsToolbar
          onOpenFields={() => setActiveModal("fields")}
          onOpenImport={() => setActiveModal("import")}
          onExport={handleExport}
          onExportResponses={handleExportResponses}
          onOpenNew={() => setActiveModal("new")}
          hiddenColumns={hiddenColumns}
          onToggleColumn={toggleColumn}
        />
      </div>

      <ContactsFiltersBar
        filters={filters}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onChange={(patch) => setFilters((previous) => ({ ...previous, ...patch }))}
        options={filterOptions}
      />

      {selectedIds.size > 0 ? (
        <p className="text-sm font-medium text-adlive-primary" role="status">
          {selectedIds.size} contacto{selectedIds.size === 1 ? "" : "s"} seleccionado
          {selectedIds.size === 1 ? "" : "s"}
        </p>
      ) : null}

      <ContactsTable
        contacts={filteredContacts}
        hiddenColumns={hiddenColumns}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onDelete={handleDelete}
      />

      <NewContactModal open={activeModal === "new"} onClose={() => setActiveModal(null)} />
      <ImportContactsModal open={activeModal === "import"} onClose={() => setActiveModal(null)} />
      <CustomFieldsModal open={activeModal === "fields"} onClose={() => setActiveModal(null)} />
    </div>
  );
}
