"use client";

import { useEffect, useMemo, useState } from "react";

import { formatNumber } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

import { ContactsFiltersBar, type FilterOptions } from "./ContactsFilters";
import { ContactsTable } from "./ContactsTable";
import { ContactsToolbar } from "./ContactsToolbar";
import { CustomFieldsModal } from "./CustomFieldsModal";
import { ImportContactsModal } from "./ImportContactsModal";
import { NewContactModal } from "./NewContactModal";
import { useDebouncedValue } from "./useDebouncedValue";
import { EMPTY_CONTACTS_FILTERS, buildContactsCsv, buildResponsesCsv, downloadCsvFile, filterContacts, type ContactsColumnKey, type ContactsFilters } from "./contactsUtils";

type ActiveModal = "new" | "import" | "fields" | null;

export function ContactsView() {
  const { contacts, opportunities, conversations, pipelines, pipelineStages, activeTenant, deleteContact, contactTotal, contactPageSize, contactQuery, setContactQuery } = useCrm();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [filters, setFilters] = useState<Omit<ContactsFilters, "search">>(EMPTY_CONTACTS_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<ContactsColumnKey[]>([]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const filtersWithSearch = useMemo<ContactsFilters>(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);

  useEffect(() => {
    setContactQuery({ search: debouncedSearch, tag: filters.tag, source: filters.source, createdFrom: filters.createdFrom, createdTo: filters.createdTo, actionFrom: filters.actionFrom, actionTo: filters.actionTo });
  }, [debouncedSearch, filters, setContactQuery]);

  const filterOptions = useMemo<FilterOptions>(() => ({
    tags: [...new Set(contacts.flatMap((contact) => contact.tags))].sort(),
    sources: [...new Set(contacts.map((contact) => contact.lead_source))].sort(), pipelines, stages: pipelineStages,
  }), [contacts, pipelines, pipelineStages]);
  const filteredContacts = useMemo(() => filterContacts(contacts, opportunities, filtersWithSearch), [contacts, opportunities, filtersWithSearch]);
  const pageCount = Math.max(1, Math.ceil(contactTotal / contactPageSize));

  const toggleColumn = (column: ContactsColumnKey) => setHiddenColumns((previous) => previous.includes(column) ? previous.filter((item) => item !== column) : [...previous, column]);
  const toggleSelect = (contactId: string) => setSelectedIds((previous) => { const next = new Set(previous); if (next.has(contactId)) next.delete(contactId); else next.add(contactId); return next; });
  const toggleSelectAll = () => setSelectedIds((previous) => filteredContacts.length > 0 && filteredContacts.every((contact) => previous.has(contact.id)) ? new Set<string>() : new Set(filteredContacts.map((contact) => contact.id)));
  const handleDelete = (contactId: string) => {
    setSelectedIds((previous) => { const next = new Set(previous); next.delete(contactId); return next; });
    deleteContact(contactId);
  };
  const handleExport = () => downloadCsvFile(`contactos-${activeTenant?.slug ?? "workspace"}.csv`, buildContactsCsv(filteredContacts));
  const handleExportResponses = () => {
    const ids = new Set(filteredContacts.map((contact) => contact.id));
    downloadCsvFile(`reporte-respuestas-${activeTenant?.slug ?? "workspace"}.csv`, buildResponsesCsv(conversations.filter((item) => ids.has(item.contact_id)), filteredContacts));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="sr-only" aria-live="polite">Mostrando {filteredContacts.length} resultados de {contactTotal} contactos de {activeTenant?.name ?? ""}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-adlive-text-main">Contactos</h1><p className="mt-1 text-sm text-adlive-text-muted">{formatNumber(filteredContacts.length)} en esta página · {formatNumber(contactTotal)} resultados</p></div>
        <ContactsToolbar onOpenFields={() => setActiveModal("fields")} onOpenImport={() => setActiveModal("import")} onExport={handleExport} onExportResponses={handleExportResponses} onOpenNew={() => setActiveModal("new")} hiddenColumns={hiddenColumns} onToggleColumn={toggleColumn} />
      </div>
      <ContactsFiltersBar filters={filters} searchInput={searchInput} onSearchInput={setSearchInput} onChange={(patch) => setFilters((previous) => ({ ...previous, ...patch }))} options={filterOptions} />
      {selectedIds.size > 0 ? <p className="text-sm font-medium text-adlive-primary" role="status">{selectedIds.size} contacto{selectedIds.size === 1 ? "" : "s"} seleccionado{selectedIds.size === 1 ? "" : "s"} en esta página</p> : null}
      <ContactsTable contacts={filteredContacts} hiddenColumns={hiddenColumns} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll} onDelete={handleDelete} />
      <nav aria-label="Paginación de contactos" className="flex flex-wrap items-center justify-between gap-3 text-sm text-adlive-text-muted">
        <span>Página {Math.min(contactQuery.page + 1, pageCount)} de {pageCount}</span>
        <div className="flex gap-2">
          <button type="button" disabled={contactQuery.page === 0} onClick={() => setContactQuery({ page: Math.max(0, contactQuery.page - 1) })} className="rounded-lg border border-adlive-border bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
          <button type="button" disabled={contactQuery.page + 1 >= pageCount} onClick={() => setContactQuery({ page: contactQuery.page + 1 })} className="rounded-lg border border-adlive-border bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
        </div>
      </nav>
      <NewContactModal open={activeModal === "new"} onClose={() => setActiveModal(null)} />
      <ImportContactsModal open={activeModal === "import"} onClose={() => setActiveModal(null)} />
      <CustomFieldsModal open={activeModal === "fields"} onClose={() => setActiveModal(null)} />
    </div>
  );
}
