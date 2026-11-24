"use client";

/**
 * Utilidades puras del módulo M6 — Automatizaciones (etiquetas, tonos,
 * opciones de ramas y formato de la tabla de workflows). Cero dependencias UI.
 */

import type {
  BadgeTone,
} from "@/shared/components/ui/Badge";
import { TRIGGER_NODE_LABELS, workflowStatusLabel } from "@/shared/lib/workflowEngine";
import type { WorkflowStatus, WorkflowTriggerType } from "@/shared/types/database";

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = TRIGGER_NODE_LABELS;

export const TRIGGER_OPTIONS: Array<{ value: WorkflowTriggerType; label: string }> = [
  { value: "manual_enrollment", label: TRIGGER_LABELS.manual_enrollment },
  { value: "contact_created", label: TRIGGER_LABELS.contact_created },
  { value: "channel_message_received", label: TRIGGER_LABELS.channel_message_received },
];

export function workflowStatusTone(status: WorkflowStatus): BadgeTone {
  return status === "Published" ? "success" : "neutral";
}

export { workflowStatusLabel };

/** Etiqueta legible del resultado de un log de ejecución (QA-007: español). */
export function outcomeLabel(outcome: "success" | "error" | "skipped"): string {
  if (outcome === "success") return "Éxito";
  if (outcome === "error") return "Error";
  return "Omitido";
}

/** Estados de inscripción → etiqueta legible + tono de badge. */
export function enrollmentStatusMeta(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case "completed":
      return { label: "Completado", tone: "success" };
    case "waiting_reply":
      return { label: "Esperando respuesta", tone: "warning" };
    case "active":
      return { label: "Activo", tone: "cyan" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export const BRANCH_OPTION_TONES: Record<string, BadgeTone> = {
  Si: "success",
  No: "danger",
  "Otra respuesta": "warning",
  Undelivered: "neutral",
  "Time Out": "neutral",
};

/** Opciones configuradas en un nodo condicional (config.opciones). */
export function branchOptionsOf(config: Record<string, string>): string[] {
  return (config.opciones ?? "")
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

/** Etiqueta corta del resultado de un log de ejecución. */
export function outcomeTone(outcome: "success" | "error" | "skipped"): BadgeTone {
  if (outcome === "success") return "success";
  if (outcome === "error") return "danger";
  return "neutral";
}
