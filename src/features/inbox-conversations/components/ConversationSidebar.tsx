"use client";

/**
 * M5 — Columna 1: buscador, filtros por modo, píldoras de tipificación,
 * selector de asignación y lista de hilos del Call Center.
 */

import { Search } from "lucide-react";

import type { Contact, ConversationWithDetails, TenantMember } from "@/shared/types/database";

import { ConversationThreadList } from "./ConversationThreadList";
import {
  MODE_FILTER_LABELS,
  TYPIFICATION_PILLS,
  type InboxFilter,
  type InboxModeFilter,
} from "./inboxUtils";

const MODE_ORDER: InboxModeFilter[] = ["all", "bot", "human", "unread", "starred", "untyped"];

interface ConversationSidebarProps {
  threads: ConversationWithDetails[];
  totalCount: number;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  members: TenantMember[];
  contacts: Contact[];
}

export function ConversationSidebar({
  threads,
  totalCount,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  members,
  contacts,
}: ConversationSidebarProps) {
  const activeAgents = members.filter((member) => member.is_active);

  return (
    <section
      aria-label="Lista de conversaciones"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-adlive-border bg-white"
    >
      {/* Buscador */}
      <div className="border-b border-adlive-border p-3">
        <label htmlFor="inbox-search" className="sr-only">
          Buscar conversación
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
          <input
            id="inbox-search"
            type="search"
            value={filter.search}
            onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
            placeholder="Buscar conversación..."
            className="h-10 w-full rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 pl-9 pr-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        </div>

        {/* Primera fila de filtros */}
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Filtros de conversaciones">
          {MODE_ORDER.map((mode) => {
            const isActive = filter.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange({ ...filter, mode })}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-adlive-primary bg-adlive-primary text-adlive-text-inverse"
                    : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/40 hover:text-adlive-primary"
                }`}
              >
                {MODE_FILTER_LABELS[mode]}
              </button>
            );
          })}
        </div>

        {/* Píldoras de tipificación Call Center */}
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Tipificación Call Center">
          {TYPIFICATION_PILLS.map((pill) => {
            const isActive = filter.typification === pill;
            return (
              <button
                key={pill}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onFilterChange({ ...filter, typification: isActive ? null : pill })
                }
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? "border-adlive-cyan bg-adlive-cyan-light text-cyan-800"
                    : "border-adlive-border bg-adlive-canvas-bg/60 text-adlive-text-muted hover:border-adlive-cyan/50 hover:text-cyan-700"
                }`}
              >
                {pill}
              </button>
            );
          })}
        </div>

        {/* Selector de asignación */}
        <label htmlFor="inbox-assignee" className="sr-only">
          Filtrar por asesor asignado
        </label>
        <select
          id="inbox-assignee"
          value={filter.assignee}
          onChange={(event) => onFilterChange({ ...filter, assignee: event.target.value })}
          className="mt-2.5 h-9 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-3 text-xs font-medium text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        >
          <option value="all">Asignadas y sin asignar</option>
          <option value="unassigned">Sin asignar</option>
          {activeAgents.map((member) => (
            <option key={member.id} value={member.id}>
              {member.email}
            </option>
          ))}
        </select>
      </div>

      {/* Contador + lista de hilos */}
      <p className="border-b border-adlive-border bg-adlive-canvas-bg/40 px-3 py-1.5 text-[11px] font-medium text-adlive-text-muted" aria-live="polite">
        {threads.length} de {totalCount} conversaciones
      </p>
      <ConversationThreadList threads={threads} selectedId={selectedId} onSelect={onSelect} contacts={contacts} />
    </section>
  );
}
