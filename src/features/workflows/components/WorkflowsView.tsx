"use client";

/**
 * M6 — Listado de Automatizaciones (`/automatizaciones`).
 * Cabecera con creación de workflow, banner de canales conectados y tabla
 * de flujos con estado, disparador, inscritos y activos.
 */

import { ArrowRight, Plus, Plug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";

import { CreateWorkflowModal } from "./CreateWorkflowModal";
import { WorkflowsTable } from "./WorkflowsTable";

export function WorkflowsView() {
  const { workflows, integrations, toggleWorkflowStatus, deleteWorkflow } = useCrm();
  const [showCreate, setShowCreate] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const connectedChannels = integrations
    .filter((integration) => integration.is_connected)
    .map((integration) => integration.provider === "whatsapp_cloud_api" ? "WhatsApp" : integration.provider);

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Automatizaciones</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">Workflows visuales para dar seguimiento automático</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Crear workflow
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-adlive-cyan/30 bg-adlive-cyan-light px-5 py-4">
        <p className="flex items-center gap-2.5 text-sm text-adlive-text-main">
          <Plug className="h-5 w-5 shrink-0 text-adlive-cyan" aria-hidden />
          <span>
            Canales conectados disponibles como trigger o acción:{" "}
            <strong className="font-semibold">{connectedChannels.length > 0 ? connectedChannels.join(", ") : "ninguno todavía"}</strong>.
          </span>
        </p>
        <Link
          href="/integraciones"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-adlive-primary transition-colors duration-150 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
        >
          Gestionar integraciones
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <WorkflowsTable
        workflows={workflows}
        onToggleStatus={(workflow) => {
          toggleWorkflowStatus(workflow.id);
          setAnnouncement(
            `Workflow «${workflow.name}» ${workflow.status === "Published" ? "despublicado" : "publicado"}.`,
          );
        }}
        onDelete={(workflow) => {
          deleteWorkflow(workflow.id);
          setAnnouncement(`Workflow «${workflow.name}» eliminado.`);
        }}
      />

      <CreateWorkflowModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
