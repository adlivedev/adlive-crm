"use client";

/**
 * Utilidades puras del módulo M6 — Automatizaciones (etiquetas, tonos,
 * opciones de ramas y formato de la tabla de workflows). Cero dependencias UI.
 */

import type {
  BadgeTone,
} from "@/shared/components/ui/Badge";
import type { WorkflowStatus, WorkflowTriggerType } from "@/shared/types/database";

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  manual_enrollment: "Inscripción manual",
  contact_created: "Contacto creado",
  channel_message_received: "Mensaje recibido en un canal",
};

export const TRIGGER_OPTIONS: Array<{ value: WorkflowTriggerType; label: string }> = [
  { value: "manual_enrollment", label: TRIGGER_LABELS.manual_enrollment },
  { value: "contact_created", label: TRIGGER_LABELS.contact_created },
  { value: "channel_message_received", label: TRIGGER_LABELS.channel_message_received },
];

export function workflowStatusTone(status: WorkflowStatus): BadgeTone {
  return status === "Published" ? "success" : "neutral";
}

/** Estados de inscripción → etiqueta legible + tono de badge. */
export function enrollmentStatusMeta(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case "completed":
      return { label: "completed", tone: "success" };
    case "waiting_reply":
      return { label: "waiting_reply", tone: "warning" };
    case "active":
      return { label: "active", tone: "cyan" };
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
