"use client";

/**
 * M4 — Tablero Kanban de Oportunidades (`/oportunidades`).
 * Pipeline comercial en 6 etapas con Drag & Drop nativo HTML5 y alta de
 * oportunidades conectada al store reactivo (los KPIs del Dashboard se
 * actualizan al instante al mover, ganar o perder tarjetas).
 */

import { KanbanView } from "@/features/opportunities-kanban/components/KanbanView";

export default function OportunidadesPage() {
  return <KanbanView />;
}
