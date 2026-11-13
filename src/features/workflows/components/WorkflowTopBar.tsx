"use client";

/**
 * Barra superior del Workflow (M6): enlace de regreso, nombre del flujo,
 * subtítulo «Constructor visual de flujos», indicador ✓ Saved, badge de
 * estado y switch interactivo «Publicar».
 */

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow } from "@/shared/types/database";

import { workflowStatusTone } from "./workflowUtils";

interface WorkflowTopBarProps {
  workflow: Workflow;
  savedAt: Date | null;
}

export function WorkflowTopBar({ workflow, savedAt }: WorkflowTopBarProps) {
  const { toggleWorkflowStatus } = useCrm();
  const isPublished = workflow.status === "Published";

  return (
    <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
      <Link
        href="/automatizaciones"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-adlive-text-muted transition-colors duration-150 hover:bg-adlive-primary-light hover:text-adlive-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Workflows
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate font-mono text-lg font-bold tracking-tight text-adlive-text-main">{workflow.name}</h1>
          <Badge tone={workflowStatusTone(workflow.status)}>{workflow.status}</Badge>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-adlive-success" role="status">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Saved
            {savedAt
              ? ` · ${savedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
              : ""}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-adlive-text-muted">Constructor visual de flujos</p>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-adlive-text-main" id="workflow-publish-label">
          Publicar
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isPublished}
          aria-labelledby="workflow-publish-label"
          onClick={() => toggleWorkflowStatus(workflow.id)}
          className={`relative h-7 w-12 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary ${
            isPublished ? "bg-adlive-success" : "bg-adlive-border"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-card transition-all duration-150 ${
              isPublished ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
