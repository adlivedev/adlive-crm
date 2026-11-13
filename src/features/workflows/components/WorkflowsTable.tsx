"use client";

/**
 * Tabla de workflows del módulo M6: nombre (enlace al constructor), descripción,
 * estado conmutable, disparador, inscritos, activos y eliminación en dos pasos.
 */

import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { formatNumber } from "@/shared/lib/format";
import type { Workflow } from "@/shared/types/database";

import { TRIGGER_LABELS, workflowStatusTone } from "./workflowUtils";

interface WorkflowsTableProps {
  workflows: Workflow[];
  onToggleStatus: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
}

export function WorkflowsTable({ workflows, onToggleStatus, onDelete }: WorkflowsTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (workflows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-base font-semibold text-adlive-text-main">Aún no hay workflows</p>
        <p className="max-w-md text-sm text-adlive-text-muted">
          Crea tu primer workflow visual para automatizar difusiones por WhatsApp, el reparto de leads
          entre agentes y el seguimiento de oportunidades.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-adlive-border bg-adlive-canvas-bg/60 text-xs uppercase tracking-wide text-adlive-text-muted">
              <th scope="col" className="px-6 py-3.5 font-semibold">Nombre</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Descripción</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Estado</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Disparador</th>
              <th scope="col" className="px-4 py-3.5 text-right font-semibold">Inscritos</th>
              <th scope="col" className="px-4 py-3.5 text-right font-semibold">Activos</th>
              <th scope="col" className="px-4 py-3.5 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((workflow) => {
              const isConfirming = confirmDeleteId === workflow.id;
              return (
                <tr key={workflow.id} className="border-b border-adlive-border/70 transition-colors last:border-0 hover:bg-adlive-primary-light/40">
                  <td className="px-6 py-4">
                    <Link
                      href={`/automatizaciones/${workflow.id}`}
                      className="group inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm font-semibold text-adlive-primary hover:underline"
                    >
                      {workflow.name}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </Link>
                  </td>
                  <td className="max-w-[320px] px-4 py-4">
                    <p className="truncate text-adlive-text-muted" title={workflow.description ?? undefined}>
                      {workflow.description ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(workflow)}
                      title={workflow.status === "Published" ? "Clic para despublicar" : "Clic para publicar"}
                      className="cursor-pointer rounded-full transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
                    >
                      <Badge tone={workflowStatusTone(workflow.status)}>{workflow.status}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-adlive-text-main">{TRIGGER_LABELS[workflow.trigger_type]}</td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums text-adlive-text-main">
                    {formatNumber(workflow.enrolled_count)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums text-adlive-text-main">
                    {formatNumber(workflow.active_count)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => (isConfirming ? onDelete(workflow) : setConfirmDeleteId(workflow.id))}
                      onBlur={() => setConfirmDeleteId((current) => (current === workflow.id ? null : current))}
                      className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        isConfirming
                          ? "bg-adlive-danger text-white focus-visible:outline-adlive-danger"
                          : "text-adlive-text-muted hover:bg-red-50 hover:text-adlive-danger focus-visible:outline-adlive-danger"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {isConfirming ? "¿Confirmar?" : "Eliminar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
