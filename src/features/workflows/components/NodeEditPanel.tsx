"use client";

/**
 * Panel lateral del constructor (M6): edita los parámetros del nodo
 * (plantilla a enviar, etapa del pipeline), agrega nuevos pasos de acción
 * y lanza la «Simulación de Ejecución del Workflow» con reparto Round Robin.
 */

import { FlaskConical, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow, WorkflowNode } from "@/shared/types/database";

export type PanelState =
  | { mode: "edit"; node: WorkflowNode }
  | { mode: "insert"; sourceNodeId: string; edgeLabel: string | null }
  | null;

const ACTION_TYPES = [
  { value: "Enviar WhatsApp", needs: "template" },
  { value: "Marcar en seguimiento", needs: "none" },
  { value: "Mover a etapa", needs: "stage" },
  { value: "Crear oportunidad", needs: "stage" },
  { value: "Asignar a un miembro (Round robin)", needs: "none" },
] as const;

type ActionType = (typeof ACTION_TYPES)[number]["value"];

const SELECT_CLASS =
  "h-10 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

interface NodeEditPanelProps {
  workflow: Workflow;
  panel: PanelState;
  onClose: () => void;
  onSaved: () => void;
  onSimulate: () => void;
}

export function NodeEditPanel({ workflow, panel, onClose, onSaved, onSimulate }: NodeEditPanelProps) {
  const { templates, pipelineStages, members, updateWorkflowNodeConfig, addWorkflowActionNode } = useCrm();

  const [actionType, setActionType] = useState<ActionType>("Enviar WhatsApp");
  const [templateName, setTemplateName] = useState("");
  const [stageId, setStageId] = useState("");
  const [feedback, setFeedback] = useState("");

  const approvedTemplates = templates.filter((template) => template.status === "APPROVED");
  const openStages = pipelineStages.filter((stage) => stage.stage_category === "open");
  const activeAgents = members.filter((member) => member.is_active && member.role === "agent");

  useEffect(() => {
    if (!panel) return;
    setFeedback("");
    if (panel.mode === "edit") {
      setTemplateName(panel.node.config.template ?? approvedTemplates[0]?.name ?? "");
      setStageId(panel.node.config.stage_id ?? openStages[0]?.id ?? "");
    } else {
      setActionType("Enviar WhatsApp");
      setTemplateName(approvedTemplates[0]?.name ?? "");
      setStageId(openStages[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panel, onClose]);

  if (!panel) return null;

  const editNode = panel.mode === "edit" ? panel.node : null;
  const needsTemplate = editNode ? editNode.label.startsWith("Enviar WhatsApp") : actionType === "Enviar WhatsApp";
  const needsStage = editNode
    ? editNode.label.startsWith("Mover a") || editNode.label.startsWith("Crear oportunidad")
    : actionType === "Mover a etapa" || actionType === "Crear oportunidad";
  const stageValue = editNode?.config.stage_id ?? stageId;

  const handleApply = () => {
    if (panel.mode === "edit" && editNode) {
      const config: Record<string, string> = {};
      if (needsTemplate && templateName) config.template = templateName;
      if (needsStage && stageValue) {
        config.stage_id = stageValue;
        const stage = pipelineStages.find((item) => item.id === stageValue);
        if (stage) config.stage_name = stage.name;
      }
      updateWorkflowNodeConfig(workflow.id, editNode.id, config);
      onSaved();
      setFeedback("Cambios aplicados al paso.");
      return;
    }
    if (panel.mode === "insert") {
      const config: Record<string, string> = {};
      let label: string = actionType;
      if (actionType === "Enviar WhatsApp" && templateName) config.template = templateName;
      if (actionType === "Mover a etapa" || actionType === "Crear oportunidad") {
        const stage = pipelineStages.find((item) => item.id === stageId);
        if (!stage) {
          setFeedback("Selecciona una etapa del pipeline.");
          return;
        }
        config.stage_id = stage.id;
        config.stage_name = stage.name;
        label = actionType === "Mover a etapa" ? `Mover a ${stage.name}` : `Crear oportunidad (${stage.name})`;
      }
      if (actionType === "Asignar a un miembro (Round robin)") {
        label = `Asignar a un miembro (Round robin entre ${activeAgents.length} agentes)`;
      }
      addWorkflowActionNode(workflow.id, panel.sourceNodeId, { label, config, edgeLabel: panel.edgeLabel });
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Editor de paso del workflow">
      <button type="button" aria-label="Cerrar panel" onClick={onClose} className="absolute inset-0 cursor-pointer bg-adlive-sidebar-bg/30" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-adlive-border bg-white shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-adlive-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-adlive-text-main">
              {panel.mode === "edit" ? editNode?.label : "Insertar nuevo paso"}
            </h2>
            <p className="mt-0.5 text-xs text-adlive-text-muted">
              {panel.mode === "edit" ? "Edita los parámetros de este nodo." : "El nuevo paso quedará conectado al flujo."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-adlive-canvas-bg hover:text-adlive-text-main"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {panel.mode === "insert" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-action-type" className="text-sm font-medium text-adlive-text-main">
                Tipo de paso
              </label>
              <select
                id="panel-action-type"
                value={actionType}
                onChange={(event) => setActionType(event.target.value as ActionType)}
                className={SELECT_CLASS}
              >
                {ACTION_TYPES.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.value}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needsTemplate ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-template" className="text-sm font-medium text-adlive-text-main">
                Plantilla a enviar
              </label>
              <select
                id="panel-template"
                value={editNode?.config.template ?? templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                className={SELECT_CLASS}
              >
                {approvedTemplates.length === 0 ? <option value="">Sin plantillas aprobadas</option> : null}
                {approvedTemplates.map((template) => (
                  <option key={template.id} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needsStage ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-stage" className="text-sm font-medium text-adlive-text-main">
                Etapa del pipeline
              </label>
              <select
                id="panel-stage"
                value={stageValue}
                onChange={(event) => setStageId(event.target.value)}
                className={SELECT_CLASS}
              >
                {openStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {editNode?.label.startsWith("Asignar a un miembro") ? (
            <p className="rounded-xl bg-adlive-cyan-light px-4 py-3 text-xs leading-5 text-adlive-text-main">
              El reparto Round Robin se ejecuta en el servidor sobre los {activeAgents.length} agentes activos,
              eligiendo siempre al que lleva más tiempo sin recibir un lead.
            </p>
          ) : null}

          {editNode?.type === "branch" ? (
            <p className="rounded-xl bg-adlive-canvas-bg px-4 py-3 text-xs leading-5 text-adlive-text-muted">
              Las ramas condicionales se evalúan con la respuesta del cliente tras el envío de WhatsApp.
            </p>
          ) : null}

          {feedback ? (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-adlive-success">
              {feedback}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-adlive-border px-5 py-4">
          <Button onClick={handleApply} className="w-full">
            {panel.mode === "edit" ? "Guardar cambios" : "Agregar paso"}
          </Button>
          <Button variant="secondary" onClick={onSimulate} className="w-full">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Inscribir contacto
          </Button>
        </div>
      </div>
    </div>
  );
}
