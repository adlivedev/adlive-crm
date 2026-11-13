"use client";

/**
 * M5 — Pestaña «Crear/Ver Oportunidad ($)»: oportunidades del contacto en el
 * pipeline activo y alta rápida de una nueva (etapa «Nuevo Lead» por defecto).
 */

import { DollarSign, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { formatCOP } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, StageType } from "@/shared/types/database";

const STAGE_TONES: Record<StageType, string> = {
  open: "bg-adlive-primary-light text-adlive-primary border-adlive-primary/20",
  won: "bg-emerald-50 text-adlive-success border-emerald-200",
  lost: "bg-red-50 text-adlive-danger border-red-200",
};

export function ContextOpportunityPanel({ contact }: { contact: Contact }) {
  const { opportunities, pipelines, pipelineStages, createOpportunity } = useCrm();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("38000");

  const contactOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.contact_id === contact.id),
    [opportunities, contact.id],
  );

  const activePipeline = pipelines.find((pipeline) => pipeline.is_default) ?? pipelines[0];
  const openStages = pipelineStages.filter((stage) => stage.pipeline_id === activePipeline?.id && stage.stage_category === "open");
  const defaultStage = openStages[0];
  const stageById = new Map(pipelineStages.map((stage) => [stage.id, stage]));

  const handleCreate = () => {
    const trimmedTitle = title.trim();
    const monetaryValue = Number(value);
    if (!trimmedTitle || !activePipeline || !defaultStage || Number.isNaN(monetaryValue) || monetaryValue <= 0) return;
    createOpportunity({
      contact_id: contact.id,
      pipeline_id: activePipeline.id,
      stage_id: defaultStage.id,
      title: trimmedTitle,
      monetary_value: monetaryValue,
      assigned_member_id: contact.assigned_member_id,
    });
    setTitle("");
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-adlive-text-muted">Oportunidades del contacto</h4>

      {/* Alta rápida */}
      <div className="flex flex-col gap-2 rounded-xl border border-adlive-border p-3">
        <label htmlFor="ctx-opp-title" className="text-[11px] font-medium text-adlive-text-muted">
          Nombre de la oportunidad
        </label>
        <input
          id="ctx-opp-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Portabilidad plan 50GB…"
          className="h-9 rounded-lg border border-adlive-border bg-white px-2.5 text-xs text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <label htmlFor="ctx-opp-value" className="text-[11px] font-medium text-adlive-text-muted">
          Valor (COP)
        </label>
        <input
          id="ctx-opp-value"
          type="number"
          min={0}
          step={1000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 rounded-lg border border-adlive-border bg-white px-2.5 text-xs text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <Button type="button" variant="primary" size="sm" onClick={handleCreate} disabled={!title.trim()} className="self-end">
          <DollarSign className="h-3.5 w-3.5" aria-hidden />
          Crear oportunidad
        </Button>
      </div>

      {/* Listado */}
      {contactOpportunities.length === 0 ? (
        <p className="py-4 text-center text-xs text-adlive-text-muted">Este contacto aún no tiene oportunidades.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Oportunidades del contacto">
          {contactOpportunities.map((opportunity) => {
            const stage = stageById.get(opportunity.stage_id);
            return (
              <li key={opportunity.id} className="flex flex-col gap-1.5 rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-3 py-2.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-adlive-text-main">{opportunity.title}</span>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium ${STAGE_TONES[opportunity.status]}`}>
                    {stage?.name ?? opportunity.status}
                  </span>
                </span>
                <span className="text-xs font-bold text-adlive-primary">{formatCOP(opportunity.monetary_value)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {activePipeline ? (
        <Link
          href="/oportunidades"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-adlive-border px-3 py-2 text-xs font-semibold text-adlive-text-muted transition-colors hover:border-adlive-primary/40 hover:text-adlive-primary"
        >
          Ver pipeline completo
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
