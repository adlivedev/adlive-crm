"use client";

/**
 * M6 — Interior del Workflow (`/automatizaciones/[id]`).
 * Orquesta la barra superior del flujo y las 4 pestañas: Builder (lienzo
 * visual), Settings, Enrollment history y Execution logs.
 */

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Card } from "@/shared/components/ui/Card";
import { useCrm } from "@/shared/services/crmStore";

import { BuilderTab } from "./BuilderTab";
import { EnrollmentHistoryTab } from "./EnrollmentHistoryTab";
import { ExecutionLogsTab } from "./ExecutionLogsTab";
import { SettingsTab } from "./SettingsTab";
import { WorkflowTopBar } from "./WorkflowTopBar";

export type WorkflowTab = "builder" | "settings" | "enrollment" | "logs";

const TABS: Array<{ id: WorkflowTab; label: string }> = [
  { id: "builder", label: "Builder" },
  { id: "settings", label: "Settings" },
  { id: "enrollment", label: "Enrollment history" },
  { id: "logs", label: "Execution logs" },
];

interface WorkflowDetailViewProps {
  workflowId: string;
}

export function WorkflowDetailView({ workflowId }: WorkflowDetailViewProps) {
  const { workflows, workflowEnrollments } = useCrm();
  const [tab, setTab] = useState<WorkflowTab>("builder");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const workflow = workflows.find((w) => w.id === workflowId) ?? null;
  const enrollments = workflowEnrollments.filter((e) => e.workflow_id === workflowId);

  if (!workflow) {
    return (
      <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-base font-semibold text-adlive-text-main">Workflow no encontrado</p>
        <p className="max-w-md text-sm text-adlive-text-muted">
          Es posible que haya sido eliminado o que el enlace sea de otra cuenta.
        </p>
        <Link
          href="/automatizaciones"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-adlive-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-adlive-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a Workflows
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkflowTopBar workflow={workflow} savedAt={savedAt} />

      <div role="tablist" aria-label="Secciones del workflow" className="flex flex-wrap gap-1 rounded-2xl border border-adlive-border bg-white p-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`wf-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`wf-panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary ${
              tab === item.id
                ? "bg-adlive-primary text-white shadow-card"
                : "text-adlive-text-muted hover:bg-adlive-primary-light hover:text-adlive-primary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`wf-panel-${tab}`} aria-labelledby={`wf-tab-${tab}`}>
        {tab === "builder" ? <BuilderTab workflow={workflow} onSaved={() => setSavedAt(new Date())} /> : null}
        {tab === "settings" ? <SettingsTab workflow={workflow} onSaved={() => setSavedAt(new Date())} /> : null}
        {tab === "enrollment" ? (
          <EnrollmentHistoryTab workflow={workflow} enrollments={enrollments} />
        ) : null}
        {tab === "logs" ? <ExecutionLogsTab enrollments={enrollments} /> : null}
      </div>
    </div>
  );
}
