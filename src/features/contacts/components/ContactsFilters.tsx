"use client";

/**
 * M3 — Barra de filtros completa de Contactos:
 * buscador instantáneo (debounce en el padre), selectores de etiqueta,
 * fuente, pipeline y etapa, más rangos de fecha por `Creado` y
 * `Última acción / pedido` (desde/hasta).
 */

import { Search } from "lucide-react";

import { Card } from "@/shared/components/ui/Card";
import type { Pipeline, PipelineStage } from "@/shared/types/database";

import type { ContactsFilters } from "./contactsUtils";

export interface FilterOptions {
  tags: string[];
  sources: string[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
}

const SELECT_CLASS =
  "h-9 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

const DATE_CLASS =
  "h-9 w-full rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

interface ContactsFiltersProps {
  filters: Omit<ContactsFilters, "search">;
  searchInput: string;
  onSearchInput: (value: string) => void;
  onChange: (patch: Partial<Omit<ContactsFilters, "search">>) => void;
  options: FilterOptions;
}

function DateRangeField({
  legend,
  fromValue,
  toValue,
  onFrom,
  onTo,
  fromLabel,
  toLabel,
}: {
  legend: string;
  fromValue: string;
  toValue: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  fromLabel: string;
  toLabel: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className="text-sm font-medium text-adlive-text-main">
        {legend}
      </span>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`${legend}-desde`}>
          {fromLabel}
        </label>
        <input
          id={`${legend}-desde`}
          type="date"
          value={fromValue}
          onChange={(event) => onFrom(event.target.value)}
          className={DATE_CLASS}
          aria-label={fromLabel}
        />
        <span aria-hidden className="text-xs text-adlive-text-muted">
          —
        </span>
        <label className="sr-only" htmlFor={`${legend}-hasta`}>
          {toLabel}
        </label>
        <input
          id={`${legend}-hasta`}
          type="date"
          value={toValue}
          onChange={(event) => onTo(event.target.value)}
          className={DATE_CLASS}
          aria-label={toLabel}
        />
      </div>
    </fieldset>
  );
}

export function ContactsFiltersBar({ filters, searchInput, onSearchInput, onChange, options }: ContactsFiltersProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        {/* Buscador instantáneo (debounce aplicado en ContactsView). */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
          <label htmlFor="buscar-contactos" className="sr-only">
            Buscar por nombre, email, empresa o teléfono
          </label>
          <input
            id="buscar-contactos"
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            placeholder="Buscar por nombre, email, empresa o teléfono…"
            className="h-11 w-full rounded-xl border border-adlive-border bg-white pl-10 pr-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filtro-etiquetas" className="text-sm font-medium text-adlive-text-main">
              Etiquetas
            </label>
            <select
              id="filtro-etiquetas"
              value={filters.tag}
              onChange={(event) => onChange({ tag: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="all">Todas las etiquetas</option>
              {options.tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filtro-fuentes" className="text-sm font-medium text-adlive-text-main">
              Fuentes
            </label>
            <select
              id="filtro-fuentes"
              value={filters.source}
              onChange={(event) => onChange({ source: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="all">Todas las fuentes</option>
              {options.sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filtro-pipelines" className="text-sm font-medium text-adlive-text-main">
              Pipelines
            </label>
            <select
              id="filtro-pipelines"
              value={filters.pipelineId}
              onChange={(event) => onChange({ pipelineId: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="all">Todos los pipelines</option>
              {options.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filtro-etapas" className="text-sm font-medium text-adlive-text-main">
              Etapas
            </label>
            <select
              id="filtro-etapas"
              value={filters.stageId}
              onChange={(event) => onChange({ stageId: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="all">Todas las etapas</option>
              {options.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateRangeField
            legend="Creado"
            fromValue={filters.createdFrom}
            toValue={filters.createdTo}
            onFrom={(value) => onChange({ createdFrom: value })}
            onTo={(value) => onChange({ createdTo: value })}
            fromLabel="Creado desde"
            toLabel="Creado hasta"
          />
          <DateRangeField
            legend="Última acción / pedido"
            fromValue={filters.actionFrom}
            toValue={filters.actionTo}
            onFrom={(value) => onChange({ actionFrom: value })}
            onTo={(value) => onChange({ actionTo: value })}
            fromLabel="Última acción desde"
            toLabel="Última acción hasta"
          />
        </div>
      </div>
    </Card>
  );
}
