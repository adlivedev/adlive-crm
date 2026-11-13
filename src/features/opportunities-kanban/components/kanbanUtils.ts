/**
 * Utilidades puras del Tablero Kanban de Oportunidades (M4).
 * Sin dependencias de React ni del store (Skill 4 — reutilización).
 */

import type { Contact, Opportunity, PipelineStage } from "@/shared/types/database";

/** Normaliza texto para búsquedas tolerantes (tildes, mayúsculas, espacios). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Filtra oportunidades del pipeline por agente asignado y texto de búsqueda. */
export function filterKanbanOpportunities(
  opportunities: Opportunity[],
  contactsById: ReadonlyMap<string, Contact>,
  agentFilter: string,
  search: string,
): Opportunity[] {
  const needle = normalizeText(search);
  return opportunities.filter((opportunity) => {
    if (agentFilter !== "all" && (opportunity.assigned_member_id ?? "unassigned") !== agentFilter) return false;
    if (needle.length === 0) return true;
    const contact = contactsById.get(opportunity.contact_id);
    const haystack = normalizeText(
      [
        contact?.full_name ?? "",
        contact?.phone_e164 ?? "",
        opportunity.title,
        String(opportunity.monetary_value),
      ].join(" "),
    );
    return haystack.includes(needle);
  });
}

/** Suma monetaria de una columna (todas sus tarjetas visibles). */
export function sumColumnValue(opportunities: Opportunity[]): number {
  return opportunities.reduce((sum, opportunity) => sum + opportunity.monetary_value, 0);
}

/** Acento visual de cada etapa: punto de color + tinte de hover en columna. */
export interface StageAccent {
  dot: string;
  headerText: string;
}

const STAGE_ACCENTS: StageAccent[] = [
  { dot: "bg-sky-500", headerText: "text-sky-700" },
  { dot: "bg-cyan-500", headerText: "text-cyan-700" },
  { dot: "bg-violet-500", headerText: "text-violet-700" },
  { dot: "bg-amber-500", headerText: "text-amber-700" },
  { dot: "bg-emerald-500", headerText: "text-emerald-700" },
  { dot: "bg-rose-500", headerText: "text-rose-700" },
];

/** Acento estable por posición de la etapa dentro del pipeline. */
export function stageAccent(stage: PipelineStage): StageAccent {
  const index = Math.max(0, stage.position);
  return STAGE_ACCENTS[index % STAGE_ACCENTS.length]!;
}

/** Título comercial de ejemplo para planes de portabilidad (modal de alta). */
export const PLAN_TITLE_SUGGESTIONS = [
  "Plan Móvil 50GB - llamadas ilimitadas",
  "Plan Móvil 30GB - 300 minutos",
  "Plan Familiar 2 líneas 50GB",
  "Plan Empresarial 4 líneas",
] as const;
