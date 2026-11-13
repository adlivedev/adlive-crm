"use client";

/**
 * Cabecera del Kanban (M4): selector de pipeline, filtro por agente asignado,
 * buscador por contacto, resumen del valor total abierto del pipeline y
 * botón de alta de oportunidad.
 */

import { ChevronDown, DollarSign, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/components/ui/Button";
import { formatCOP } from "@/shared/lib/format";
import type { Pipeline, TenantMember } from "@/shared/types/database";

interface LabeledSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

/** Select etiquetado accesible con estilo ADlive (label sr-only + chevron). */
function LabeledSelect({ id, label, value, onChange, children }: LabeledSelectProps) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 max-w-64 cursor-pointer appearance-none truncate rounded-xl border border-adlive-border bg-white pl-4 pr-9 text-sm font-medium text-adlive-text-main transition-colors hover:border-adlive-primary focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
    </div>
  );
}

export interface KanbanHeaderProps {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onSelectPipeline: (pipelineId: string) => void;
  members: TenantMember[];
  agentFilter: string;
  onAgentFilter: (value: string) => void;
  search: string;
  onSearch: (value: string) => void;
  openValue: number;
  openCount: number;
  resultCount: number;
  onNewOpportunity: () => void;
}

export function KanbanHeader({
  pipelines,
  selectedPipelineId,
  onSelectPipeline,
  members,
  agentFilter,
  onAgentFilter,
  search,
  onSearch,
  openValue,
  openCount,
  resultCount,
  onNewOpportunity,
}: KanbanHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <LabeledSelect id="kanban-pipeline" label="Pipeline comercial" value={selectedPipelineId} onChange={onSelectPipeline}>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </LabeledSelect>
          <div className="relative">
            <label htmlFor="kanban-search" className="sr-only">
              Buscar por contacto, teléfono o plan
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
            <input
              id="kanban-search"
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar contacto, teléfono o plan…"
              className="h-11 w-64 rounded-xl border border-adlive-border bg-white pl-10 pr-4 text-sm placeholder:text-adlive-text-muted/60 transition-colors focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
          </div>
        </div>
        <Button onClick={onNewOpportunity}>
          <Plus className="h-4 w-4" aria-hidden />
          Nueva oportunidad
        </Button>
      </div>

      {/* Fila de filtros + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-adlive-border bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <LabeledSelect id="kanban-agent" label="Filtrar por agente asignado" value={agentFilter} onChange={onAgentFilter}>
            <option value="all">Todos los agentes</option>
            <option value="unassigned">Sin asignar</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.email}
              </option>
            ))}
          </LabeledSelect>
          <p className="text-sm text-adlive-text-muted" aria-live="polite">
            {resultCount} tarjeta{resultCount === 1 ? "" : "s"} visibles
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-adlive-success" aria-hidden />
          <span className="text-adlive-text-muted">Valor abierto del pipeline:</span>
          <strong className="font-mono text-base text-adlive-text-main">{formatCOP(openValue)}</strong>
          <span className="text-xs text-adlive-text-muted">· {openCount} abiertas</span>
        </p>
      </div>
    </div>
  );
}
