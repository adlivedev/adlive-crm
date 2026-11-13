"use client";

/**
 * M3 — Acordeón `Oportunidades`: lista las oportunidades del contacto
 * (etapa, valor, estado), permite crear una rápida (título + valor) en la
 * primera etapa abierta del pipeline por defecto y enlaza al tablero.
 */

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { formatCOP, formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, StageType } from "@/shared/types/database";

import { Accordion } from "./Accordion";

const STATUS_TONE: Record<StageType, "success" | "danger" | "neutral"> = {
  open: "neutral",
  won: "success",
  lost: "danger",
};

const STATUS_LABEL: Record<StageType, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};

export function OpportunitiesPanel({ contact }: { contact: Contact }) {
  const { opportunities, pipelineStages, pipelines, createOpportunity } = useCrm();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("38000");
  const [error, setError] = useState<string | null>(null);

  const contactOpportunities = opportunities.filter((opportunity) => opportunity.contact_id === contact.id);
  const openStages = pipelineStages.filter((stage) => stage.stage_category === "open");
  const defaultPipeline = pipelines.find((pipeline) => pipeline.is_default) ?? pipelines[0] ?? null;
  const defaultStage = openStages[0] ?? null;

  const stageNameOf = (stageId: string): string =>
    pipelineStages.find((stage) => stage.id === stageId)?.name ?? "Etapa desconocida";

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!defaultPipeline || !defaultStage) {
      setError("La cuenta no tiene un pipeline con etapas abiertas.");
      return;
    }
    const numericValue = Number(value.replace(/\D/g, ""));
    if (!title.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Escribe un título y un valor válido para la oportunidad.");
      return;
    }
    createOpportunity({
      contact_id: contact.id,
      pipeline_id: defaultPipeline.id,
      stage_id: defaultStage.id,
      title: title.trim(),
      monetary_value: numericValue,
    });
    setTitle("");
    setError(null);
  };

  return (
    <Accordion title="Oportunidades" subtitle={`${contactOpportunities.length} asociadas`}>
      <div className="flex flex-col gap-4">
        {contactOpportunities.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {contactOpportunities.map((opportunity) => (
              <li key={opportunity.id} className="rounded-xl border border-adlive-border px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-adlive-text-main">{opportunity.title}</p>
                  <Badge tone={STATUS_TONE[opportunity.status]}>{STATUS_LABEL[opportunity.status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-adlive-text-muted">
                  {stageNameOf(opportunity.stage_id)} · {formatCOP(opportunity.monetary_value)} · actualizada{" "}
                  {formatRelativeTime(opportunity.updated_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-adlive-text-muted">Este contacto aún no tiene oportunidades.</p>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-2.5 rounded-xl border border-dashed border-adlive-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Crear oportunidad rápida</p>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <label htmlFor="opp-rapida-titulo" className="sr-only">
              Título de la oportunidad
            </label>
            <input
              id="opp-rapida-titulo"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={defaultStage ? `Ej: Plan 50GB + llamadas ilimitadas` : "Sin etapas abiertas"}
              disabled={!defaultStage}
              className="h-10 w-full rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20 disabled:cursor-not-allowed disabled:bg-adlive-canvas-bg"
            />
            <label htmlFor="opp-rapida-valor" className="sr-only">
              Valor (COP)
            </label>
            <input
              id="opp-rapida-valor"
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={!defaultStage}
              className="h-10 w-full rounded-xl border border-adlive-border bg-white px-3 font-mono text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20 disabled:cursor-not-allowed disabled:bg-adlive-canvas-bg"
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs text-adlive-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" size="sm" className="gap-1.5 self-start" disabled={!defaultStage}>
            <Plus className="h-4 w-4 text-adlive-primary" aria-hidden />
            Crear en «{defaultStage?.name ?? "—"}»
          </Button>
        </form>

        <Link
          href="/oportunidades"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-adlive-primary underline-offset-2 hover:underline"
        >
          Ver pipeline
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Accordion>
  );
}
