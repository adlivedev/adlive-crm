/**
 * Utilidades puras del módulo de Plantillas de WhatsApp Business (M7).
 * Validaciones, variables, extractos y metadatos de estado — sin React.
 */

import type { BadgeTone } from "@/shared/components/ui/Badge";
import type { WhatsAppTemplateButton, WhatsAppTemplateStatus } from "@/shared/types/database";

/** Valores de ejemplo con los que la vista previa reemplaza {{1}}, {{2}}, … */
export const EXAMPLE_VARIABLE_VALUES = ["Laura", "$38.000", "Bogotá", "50GB"] as const;

/** snake_case exigido por Meta: minúsculas, números y guiones bajos. */
export function isValidTemplateName(name: string): boolean {
  return /^[a-z0-9_]+$/.test(name) && name.length >= 3;
}

/**
 * Número de variables detectadas = índice máximo usado en {{n}}.
 * Meta numera las variables secuencialmente desde 1.
 */
export function countVariables(body: string): number {
  let max = 0;
  const pattern = /\{\{(\d+)\}\}/g;
  let match = pattern.exec(body);
  while (match !== null) {
    max = Math.max(max, Number(match[1]));
    match = pattern.exec(body);
  }
  return max;
}

/** Reemplaza {{n}} por valores de ejemplo legibles para la vista previa. */
export function applyExampleVariables(body: string): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_token, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    return EXAMPLE_VARIABLE_VALUES[index % EXAMPLE_VARIABLE_VALUES.length]!;
  });
}

/** Extracto del cuerpo para la tabla (una línea, máx. `maxLength` caracteres). */
export function bodyExcerpt(body: string, maxLength = 90): string {
  const singleLine = body.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}

/** Metadatos visuales del estado de aprobación de Meta. */
export function statusMeta(status: WhatsAppTemplateStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "APPROVED":
      return { label: "Aprobada", tone: "success" };
    case "DISABLED":
      return { label: "Deshabilitada", tone: "neutral" };
    case "REJECTED":
      return { label: "Rechazada", tone: "danger" };
    case "PENDING":
      return { label: "En revisión", tone: "warning" };
  }
}

export interface TemplateButtonTypeOption {
  value: "QUICK_REPLY" | "URL";
  label: string;
}

export const BUTTON_TYPE_OPTIONS: TemplateButtonTypeOption[] = [
  { value: "QUICK_REPLY", label: "Respuesta rápida" },
  { value: "URL", label: "URL" },
];

/** Botones iniciales sugeridos: respuestas rápidas Sí / No. */
export function defaultQuickReplyButtons(): WhatsAppTemplateButton[] {
  return [
    { type: "QUICK_REPLY", text: "Sí" },
    { type: "QUICK_REPLY", text: "No" },
  ];
}

/** Limpia botones vacíos antes de persistir en el store. */
export function sanitizeButtons(buttons: WhatsAppTemplateButton[]): WhatsAppTemplateButton[] {
  return buttons
    .map((button) => ({
      type: button.type,
      text: button.text.trim(),
      url: button.type === "URL" ? button.url?.trim() || undefined : undefined,
    }))
    .filter((button) => button.text.length > 0 && (button.type !== "URL" || Boolean(button.url)));
}
