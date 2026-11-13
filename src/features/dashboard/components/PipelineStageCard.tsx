"use client";

/**
 * Tarjeta lateral «Pipeline por etapa» (solo etapas abiertas) con enlace al Kanban.
 */

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/shared/components/ui/Card";
import { formatCOP, formatNumber } from "@/shared/lib/format";
import type { PipelineStageSummary } from "@/shared/services/crmStore";

export interface PipelineStageCardProps {
  stages: PipelineStageSummary[];
}

export function PipelineStageCard({ stages }: PipelineStageCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Pipeline por etapa" subtitle="Solo etapas abiertas" />
      <div className="flex flex-1 flex-col px-6 py-4">
        <ul className="flex flex-col divide-y divide-adlive-border">
          {stages.map(({ stage, count, totalValue }) => (
            <li key={stage.id} className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-sm font-medium text-adlive-text-main">{stage.name}</span>
              <span className="flex items-center gap-4">
                <span className="adlive-tabular rounded-full bg-adlive-canvas-bg px-2.5 py-0.5 font-mono text-xs font-semibold text-adlive-text-muted">
                  {formatNumber(count)}
                </span>
                <span className="adlive-tabular w-20 text-right font-mono text-xs text-adlive-text-muted">
                  {formatCOP(totalValue)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <Link
            href="/oportunidades"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-adlive-cyan transition-colors duration-150 hover:text-cyan-700 hover:underline"
          >
            Ver tablero kanban
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  );
}
