"use client";

/**
 * Columna del Kanban (M4): cabecera con etapa, badge de cantidad y suma en $,
 * y zona de soltar con resaltado accesible durante el arrastre.
 */

import type { DragEvent } from "react";

import { formatCOP } from "@/shared/lib/format";
import type { Contact, Opportunity, PipelineStage, TenantMember } from "@/shared/types/database";

import { OpportunityCard } from "./OpportunityCard";
import { stageAccent } from "./kanbanUtils";

export interface KanbanColumnProps {
  stage: PipelineStage;
  opportunities: Opportunity[];
  contactsById: ReadonlyMap<string, Contact>;
  membersById: ReadonlyMap<string, TenantMember>;
  allStages: PipelineStage[];
  draggingId: string | null;
  isDropTarget: boolean;
  onDragStartCard: (opportunityId: string) => void;
  onDragEndCard: () => void;
  onMove: (opportunityId: string, targetStageId: string) => void;
  onDropInto: (stageId: string) => void;
  onDragEnterStage: (stageId: string) => void;
}

export function KanbanColumn({
  stage,
  opportunities,
  contactsById,
  membersById,
  allStages,
  draggingId,
  isDropTarget,
  onDragStartCard,
  onDragEndCard,
  onMove,
  onDropInto,
  onDragEnterStage,
}: KanbanColumnProps) {
  const accent = stageAccent(stage);
  const wonStageId = allStages.find((s) => s.stage_category === "won")?.id ?? null;
  const lostStageId = allStages.find((s) => s.stage_category === "lost")?.id ?? null;
  const columnTotal = opportunities.reduce((sum, opportunity) => sum + opportunity.monetary_value, 0);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (draggingId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      onDragEnterStage(stage.id);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const opportunityId = event.dataTransfer.getData("text/plain");
    if (opportunityId) onDropInto(stage.id);
  };

  return (
    <section
      aria-label={`Etapa ${stage.name}, ${opportunities.length} oportunidades por ${formatCOP(columnTotal)}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex w-[280px] shrink-0 flex-col rounded-2xl border bg-adlive-canvas-bg/70 transition-colors duration-150 xl:w-[300px] ${
        isDropTarget ? "border-adlive-primary border-dashed bg-adlive-primary-light/60" : "border-adlive-border"
      }`}
    >
      <header className="flex flex-col gap-1 border-b border-adlive-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${accent.headerText}`}>
            <span className={`h-2 w-2 rounded-full ${accent.dot}`} aria-hidden />
            {stage.name}
          </h3>
          <span
            aria-label={`${opportunities.length} oportunidades`}
            className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-adlive-text-muted shadow-sm"
          >
            {opportunities.length}
          </span>
        </div>
        <p className="font-mono text-xs font-medium text-adlive-text-muted" aria-label={`Suma de la etapa ${formatCOP(columnTotal)}`}>
          {formatCOP(columnTotal)}
        </p>
      </header>

      <div className="flex min-h-[160px] flex-1 flex-col gap-3 overflow-y-auto p-3" role="list" aria-label={`Oportunidades en ${stage.name}`}>
        {opportunities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-adlive-border px-3 py-6 text-center text-xs text-adlive-text-muted">
            Arrastra una oportunidad aquí o usa el selector de etapa de cada tarjeta.
          </p>
        ) : (
          opportunities.map((opportunity) => (
            <div key={opportunity.id} role="listitem">
              <OpportunityCard
                opportunity={opportunity}
                contact={contactsById.get(opportunity.contact_id) ?? null}
                assignedMember={
                  opportunity.assigned_member_id ? (membersById.get(opportunity.assigned_member_id) ?? null) : null
                }
                stages={allStages}
                wonStageId={wonStageId}
                lostStageId={lostStageId}
                isDragging={draggingId === opportunity.id}
                onDragStart={onDragStartCard}
                onDragEnd={onDragEndCard}
                onMove={onMove}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
