"use client";

/**
 * M4 — Tablero Kanban de Oportunidades (`/oportunidades`).
 *
 * Drag & Drop nativo HTML5 entre las 6 etapas del pipeline + selector rápido
 * de etapa en cada tarjeta (accesible desde móvil y teclado). Los contadores
 * y sumatorias de columnas, cabecera y Dashboard se recalculan al instante
 * porque todo vive en el store reactivo (`moveOpportunityToStage`).
 */

import { useMemo, useState } from "react";

import { useDebouncedValue } from "@/features/contacts/components/useDebouncedValue";
import { useCrm } from "@/shared/services/crmStore";

import { KanbanColumn } from "./KanbanColumn";
import { KanbanHeader } from "./KanbanHeader";
import { NewOpportunityModal } from "./NewOpportunityModal";
import { filterKanbanOpportunities } from "./kanbanUtils";

export function KanbanView() {
  const { opportunities, pipelines, pipelineStages, contacts, members, moveOpportunityToStage } = useCrm();

  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  /* Pipeline efectivo: respeta la selección y sobrevive al cambio de cuenta. */
  const effectivePipelineId = useMemo(() => {
    if (pipelines.some((pipeline) => pipeline.id === selectedPipelineId)) return selectedPipelineId;
    return pipelines.find((pipeline) => pipeline.is_default)?.id ?? pipelines[0]?.id ?? "";
  }, [pipelines, selectedPipelineId]);

  const stages = useMemo(
    () => pipelineStages.filter((stage) => stage.pipeline_id === effectivePipelineId),
    [pipelineStages, effectivePipelineId],
  );

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const pipelineOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.pipeline_id === effectivePipelineId),
    [opportunities, effectivePipelineId],
  );

  const visibleOpportunities = useMemo(
    () => filterKanbanOpportunities(pipelineOpportunities, contactsById, agentFilter, debouncedSearch),
    [pipelineOpportunities, contactsById, agentFilter, debouncedSearch],
  );

  const oppsByStage = useMemo(
    () =>
      stages.map((stage) =>
        visibleOpportunities
          .filter((opportunity) => opportunity.stage_id === stage.id)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      ),
    [stages, visibleOpportunities],
  );

  const openValue = useMemo(
    () => pipelineOpportunities.filter((opportunity) => opportunity.status === "open").reduce((sum, o) => sum + o.monetary_value, 0),
    [pipelineOpportunities],
  );
  const openCount = useMemo(() => pipelineOpportunities.filter((opportunity) => opportunity.status === "open").length, [pipelineOpportunities]);

  const handleMove = (opportunityId: string, targetStageId: string) => {
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    const stage = stages.find((item) => item.id === targetStageId);
    moveOpportunityToStage(opportunityId, targetStageId);
    if (opportunity && stage) {
      setAnnouncement(`Oportunidad de ${opportunity.title} movida a ${stage.name}.`);
    }
  };

  const handleDropInto = (stageId: string) => {
    if (draggingId) handleMove(draggingId, stageId);
    setDraggingId(null);
    setDropStageId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Oportunidades</h1>
        <p className="mt-1 text-sm text-adlive-text-muted">
          Tablero Kanban del pipeline comercial: arrastra tarjetas entre etapas o usa el selector de cada tarjeta.
        </p>
      </header>

      <KanbanHeader
        pipelines={pipelines}
        selectedPipelineId={effectivePipelineId}
        onSelectPipeline={setSelectedPipelineId}
        members={members}
        agentFilter={agentFilter}
        onAgentFilter={setAgentFilter}
        search={searchInput}
        onSearch={setSearchInput}
        openValue={openValue}
        openCount={openCount}
        resultCount={visibleOpportunities.length}
        onNewOpportunity={() => setShowNewModal(true)}
      />

      {stages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-adlive-border bg-white px-6 py-10 text-center text-sm text-adlive-text-muted">
          La cuenta activa no tiene pipeline configurado.
        </p>
      ) : (
        <div
          role="list"
          aria-label="Columnas del tablero Kanban"
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
          onDragLeave={() => setDropStageId(null)}
        >
          {stages.map((stage, index) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              opportunities={oppsByStage[index] ?? []}
              contactsById={contactsById}
              membersById={membersById}
              allStages={stages}
              draggingId={draggingId}
              isDropTarget={dropStageId === stage.id && draggingId !== null}
              onDragStartCard={(opportunityId) => {
                setDraggingId(opportunityId);
                setDropStageId(null);
              }}
              onDragEndCard={() => {
                setDraggingId(null);
                setDropStageId(null);
              }}
              onMove={handleMove}
              onDropInto={handleDropInto}
              onDragEnterStage={setDropStageId}
            />
          ))}
        </div>
      )}

      <NewOpportunityModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        pipelineId={effectivePipelineId}
        stages={stages}
      />
    </div>
  );
}
