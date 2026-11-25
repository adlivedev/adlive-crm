"use client";

/**
 * Tarjeta de nodo del lienzo visual (M6): ícono por tipo de paso, etiqueta
 * principal y configuración resumida (plantilla, etapa u origen del trigger).
 */

import { Bot, GitBranch, MessageSquare, Star, Target, Users, Zap, type LucideIcon } from "lucide-react";

import type { WorkflowNode } from "@/shared/types/database";

const NODE_ICONS: Record<WorkflowNode["type"], LucideIcon> = {
  trigger: Zap,
  action: MessageSquare,
  branch: GitBranch,
};

function actionIcon(label: string): LucideIcon {
  if (label.startsWith("Enviar WhatsApp")) return MessageSquare;
  if (label.startsWith("Activar Bot")) return Bot;
  if (label.startsWith("Marcar en seguimiento")) return Star;
  if (label.startsWith("Mover a") || label.startsWith("Crear oportunidad")) return Target;
  if (label.startsWith("Asignar a un miembro")) return Users;
  return MessageSquare;
}

function nodeSubtitle(node: WorkflowNode): string | null {
  if (node.type === "trigger") return node.config.origen ?? null;
  if (node.type === "branch") return "Ramas condicionales paralelas";
  const label = node.label;
  if (label.startsWith("Enviar WhatsApp")) {
    return node.config.template ? `Plantilla: ${node.config.template}${node.config.nota ? ` - ${node.config.nota}` : ""}` : "Sin plantilla seleccionada";
  }
  if (label.startsWith("Mover a")) return node.config.stage_name ?? null;
  if (label.startsWith("Crear oportunidad")) return node.config.stage_name ?? null;
  if (label.startsWith("Asignar a un miembro")) return "Reparto automático en el servidor";
  return null;
}

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  onClick: () => void;
}

export function WorkflowNodeCard({ node, onClick }: WorkflowNodeCardProps) {
  const Icon = node.type === "action" ? actionIcon(node.label) : NODE_ICONS[node.type];
  const subtitle = nodeSubtitle(node);
  const isTrigger = node.type === "trigger";
  const isBranch = node.type === "branch";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Editar paso: ${node.label}`}
      className={`flex w-64 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-4 py-3.5 text-center shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary ${
        isTrigger
          ? "border-adlive-primary bg-adlive-primary text-white"
          : isBranch
            ? "border-adlive-cyan bg-white"
            : "border-adlive-border bg-white hover:border-adlive-primary/50"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isTrigger ? "bg-white/20" : isBranch ? "bg-adlive-cyan-light" : "bg-adlive-primary-light"
        }`}
      >
        <Icon
          className={`h-[18px] w-[18px] ${isTrigger ? "text-white" : isBranch ? "text-adlive-cyan" : "text-adlive-primary"}`}
          aria-hidden
        />
      </span>
      <span className={`text-sm font-semibold leading-tight ${isTrigger ? "text-white" : "text-adlive-text-main"}`}>
        {node.label}
      </span>
      {subtitle ? (
        <span className={`text-[11px] leading-snug ${isTrigger ? "text-white/80" : "text-adlive-text-muted"}`}>
          {subtitle}
        </span>
      ) : null}
    </button>
  );
}
