"use client";

/**
 * Pestaña Builder (M6): lienzo visual con fondo de cuadrícula de puntos,
 * controles flotantes de zoom/pantalla completa, árbol de nodos conectados
 * con botones `+` para insertar pasos, panel lateral de edición y simulación.
 */

import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { TRIGGER_NODE_LABELS, triggerNodeConfig } from "@/shared/lib/workflowEngine";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@/shared/types/database";

import { NodeEditPanel, type PanelState } from "./NodeEditPanel";
import { SimulateModal } from "./SimulateModal";
import { WorkflowNodeCard } from "./WorkflowNodeCard";
import { BRANCH_OPTION_TONES, branchOptionsOf } from "./workflowUtils";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

const DOT_PATTERN_STYLE = {
  backgroundImage: "radial-gradient(circle, #C9CEDA 1.2px, transparent 1.2px)",
  backgroundSize: "20px 20px",
} as const;

interface BuilderTabProps {
  workflow: Workflow;
  onSaved: () => void;
}

export function BuilderTab({ workflow, onSaved }: BuilderTabProps) {
  const { pipelineStages, addWorkflowInitialNode } = useCrm();
  const [zoom, setZoom] = useState(0.7);
  const [panel, setPanel] = useState<PanelState>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const canvas = workflow.canvas_definition;
  const stageNameById = new Map(pipelineStages.map((stage) => [stage.id, stage.name]));
  const nodeById = (nodeId: string): WorkflowNode | null =>
    canvas.nodes.find((node) => node.id === nodeId) ?? null;
  const nodeWithStageNames = (node: WorkflowNode): WorkflowNode => ({
    ...node,
    config:
      node.config.stage_id && !node.config.stage_name
        ? { ...node.config, stage_name: stageNameById.get(node.config.stage_id) ?? node.config.stage_id }
        : node.config,
  });

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  };

  const insertButton = (sourceNodeId: string, edgeLabel: string | null) => (
    <div className="flex flex-col items-center" aria-hidden={false}>
      <span className="h-3 w-px bg-adlive-border" aria-hidden />
      <button
        type="button"
        onClick={() => setPanel({ mode: "insert", sourceNodeId, edgeLabel })}
        aria-label="Insertar nuevo paso"
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-adlive-primary/40 bg-white text-adlive-primary shadow-card transition-all duration-150 hover:scale-110 hover:bg-adlive-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <span className="h-3 w-px bg-adlive-border" aria-hidden />
    </div>
  );

  const renderBranch = (node: WorkflowNode): ReactNode => {
    const branchEdges = canvas.edges.filter((edge) => edge.source_node_id === node.id && edge.label !== null);
    const emptyOptions = branchOptionsOf(node.config).filter(
      (option) => !branchEdges.some((edge) => edge.label === option),
    );
    return (
      <div className="flex flex-col items-center">
        <div className="flex flex-wrap items-start justify-center gap-6">
          {branchEdges.map((edge: WorkflowEdge) => (
            <div key={edge.id} className="flex flex-col items-center">
              <Badge tone={BRANCH_OPTION_TONES[edge.label ?? ""] ?? "neutral"}>{edge.label}</Badge>
              <span className="h-4 w-px bg-adlive-border" aria-hidden />
              {renderChain(edge.target_node_id)}
            </div>
          ))}
        </div>
        {emptyOptions.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {emptyOptions.map((option) => (
              <span key={option} className="inline-flex items-center gap-1.5">
                <Badge tone={BRANCH_OPTION_TONES[option] ?? "neutral"} className="opacity-60">
                  {option}
                </Badge>
                <button
                  type="button"
                  onClick={() => setPanel({ mode: "insert", sourceNodeId: node.id, edgeLabel: option })}
                  aria-label={`Agregar acción para la rama ${option}`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-adlive-border bg-white text-adlive-text-muted transition-all duration-150 hover:border-adlive-primary hover:text-adlive-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="text-[11px] text-adlive-text-muted">sin acción</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  function renderChain(nodeId: string | null): ReactNode {
    const node = nodeId ? nodeById(nodeId) : null;
    if (!node) return null;
    const outgoing = canvas.edges.filter((edge) => edge.source_node_id === node.id);
    const linear = outgoing.find((edge) => edge.label === null) ?? null;
    return (
      <div className="flex flex-col items-center">
        <WorkflowNodeCard node={nodeWithStageNames(node)} onClick={() => setPanel({ mode: "edit", node })} />
        {node.type === "branch" ? null : insertButton(node.id, null)}
        {node.type === "branch" ? renderBranch(node) : null}
        {linear ? renderChain(linear.target_node_id) : null}
      </div>
    );
  }

  const triggerNode = canvas.nodes.find((node) => node.type === "trigger") ?? canvas.nodes[0] ?? null;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-adlive-border bg-white"
      style={DOT_PATTERN_STYLE}
    >
      <div className="overflow-auto px-6 py-10">
        <div
          className="mx-auto flex w-fit justify-center transition-transform duration-150"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {triggerNode ? (
            renderChain(triggerNode.id)
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-adlive-border bg-white/80 px-8 py-10 text-center">
              <p className="text-sm font-semibold text-adlive-text-main">Lienzo vacío</p>
              <p className="max-w-xs text-sm text-adlive-text-muted">
                Este workflow aún no tiene pasos. Agrega el disparador inicial para empezar a construir el flujo.
              </p>
              <button
                type="button"
                onClick={() => {
                  // QA-001: crea el primer nodo sin exigir un nodo origen previo.
                  addWorkflowInitialNode(workflow.id, {
                    label: TRIGGER_NODE_LABELS[workflow.trigger_type],
                    config: triggerNodeConfig(workflow.trigger_type),
                    type: "trigger",
                  });
                  onSaved();
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-adlive-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all duration-150 hover:bg-adlive-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Agregar disparador inicial
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-2xl border border-adlive-border bg-white px-2 py-1.5 shadow-card">
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Alejar lienzo"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-adlive-text-muted transition-colors hover:bg-adlive-primary-light hover:text-adlive-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-12 text-center font-mono text-xs tabular-nums text-adlive-text-main">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Acercar lienzo"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-adlive-text-muted transition-colors hover:bg-adlive-primary-light hover:text-adlive-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver lienzo en pantalla completa"}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-adlive-text-muted transition-colors hover:bg-adlive-primary-light hover:text-adlive-primary"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <NodeEditPanel
        workflow={workflow}
        panel={panel}
        onClose={() => setPanel(null)}
        onSaved={onSaved}
        onSimulate={() => setSimulateOpen(true)}
      />
      <SimulateModal workflow={workflow} open={simulateOpen} onClose={() => setSimulateOpen(false)} />
    </div>
  );
}
