"use client";

/**
 * Tarjeta de oportunidad del Kanban (M4): arrastrable (HTML5 DnD nativo),
 * con selector rápido de etapa para teclado/móvil, botones Ganado/Perdido
 * y enlaces directos a la conversación y a la ficha 360° del contacto.
 */

import { Check, MessageCircle, MoveRight, User, X } from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { formatCOP } from "@/shared/lib/format";
import type { Contact, Opportunity, PipelineStage, TenantMember } from "@/shared/types/database";

export interface OpportunityCardProps {
  opportunity: Opportunity;
  contact: Contact | null;
  assignedMember: TenantMember | null;
  stages: PipelineStage[];
  wonStageId: string | null;
  lostStageId: string | null;
  isDragging: boolean;
  onDragStart: (opportunityId: string) => void;
  onDragEnd: () => void;
  onMove: (opportunityId: string, targetStageId: string) => void;
}

export function OpportunityCard({
  opportunity,
  contact,
  assignedMember,
  stages,
  wonStageId,
  lostStageId,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
}: OpportunityCardProps) {
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData("text/plain", opportunity.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStart(opportunity.id);
  };

  const isClosed = opportunity.status !== "open";

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      aria-label={`Oportunidad ${opportunity.title}, ${formatCOP(opportunity.monetary_value)}`}
      className={`group cursor-grab rounded-2xl border border-adlive-border bg-white p-4 shadow-sm transition-all duration-150 hover:border-adlive-primary/40 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-primary active:cursor-grabbing ${
        isDragging ? "rotate-2 scale-95 opacity-60" : ""
      } ${isClosed ? "opacity-80" : ""}`}
      tabIndex={0}
    >
      {/* Nombre del contacto + enlace a ficha */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {contact ? (
            <Link
              href={`/contactos/${contact.id}`}
              className="block truncate text-sm font-semibold text-adlive-text-main underline-offset-2 hover:text-adlive-primary hover:underline"
            >
              {contact.full_name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-adlive-text-muted">Contacto eliminado</p>
          )}
          <p className="mt-0.5 font-mono text-xs text-adlive-text-muted">{contact?.phone_e164 ?? "—"}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-adlive-primary-light px-2 py-1 font-mono text-xs font-semibold text-adlive-primary">
          {formatCOP(opportunity.monetary_value)}
        </span>
      </div>

      {/* Título del plan */}
      <p className="mt-2 truncate text-sm text-adlive-text-main" title={opportunity.title}>
        {opportunity.title}
      </p>

      {/* Etiquetas del contacto (máx. 3) */}
      {contact && contact.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Etiquetas">
          {contact.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="neutral" className="px-2 py-0 text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Asesor asignado */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-adlive-text-muted">
        <User className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">{assignedMember ? assignedMember.email : "Sin asignar"}</span>
      </div>

      {/* Acciones: selector de etapa + botones rápidos */}
      <div className="mt-3 flex items-center gap-2 border-t border-adlive-border pt-3">
        <label className="sr-only" htmlFor={`stage-select-${opportunity.id}`}>
          Mover oportunidad a etapa
        </label>
        <div className="relative flex-1">
          <MoveRight className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
          <select
            id={`stage-select-${opportunity.id}`}
            value={opportunity.stage_id}
            onChange={(event) => onMove(opportunity.id, event.target.value)}
            className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-adlive-border bg-white pl-7 pr-2 text-xs text-adlive-text-main transition-colors hover:border-adlive-primary focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        {isClosed ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title="Marcar como Ganado"
              aria-label={`Marcar oportunidad de ${contact?.full_name ?? "contacto"} como Ganado`}
              disabled={wonStageId === null}
              onClick={() => wonStageId && onMove(opportunity.id, wonStageId)}
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title="Marcar como Perdido"
              aria-label={`Marcar oportunidad de ${contact?.full_name ?? "contacto"} como Perdido`}
              disabled={lostStageId === null}
              onClick={() => lostStageId && onMove(opportunity.id, lostStageId)}
              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-adlive-danger transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
        <Link
          href="/conversaciones"
          title="Abrir conversación"
          aria-label={`Abrir conversación de WhatsApp con ${contact?.full_name ?? "contacto"}`}
          className="shrink-0 rounded-lg border border-adlive-border bg-white p-1.5 text-adlive-text-muted transition-colors hover:border-adlive-cyan hover:text-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-adlive-cyan"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
