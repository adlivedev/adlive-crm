"use client";

/**
 * M5 — Columna 3: inspector derecho del contacto con barra vertical de íconos.
 * Las 6 pestañas conmutables: Info, Historial, Notas rápidas, Adjuntos,
 * Agendar Cita y Crear/Ver Oportunidad.
 */

import { CalendarClock, DollarSign, History, Info, NotebookText, Paperclip, type LucideIcon } from "lucide-react";
import { useState } from "react";

import type { Contact, Conversation } from "@/shared/types/database";

import { ContextAppointmentsPanel } from "./panels/ContextAppointmentsPanel";
import { ContextAttachmentsPanel } from "./panels/ContextAttachmentsPanel";
import { ContextHistoryPanel } from "./panels/ContextHistoryPanel";
import { ContextInfoPanel } from "./panels/ContextInfoPanel";
import { ContextNotesPanel } from "./panels/ContextNotesPanel";
import { ContextOpportunityPanel } from "./panels/ContextOpportunityPanel";

export type ContextTab = "info" | "history" | "notes" | "attachments" | "appointments" | "opportunity";

const TABS: Array<{ id: ContextTab; label: string; icon: LucideIcon }> = [
  { id: "info", label: "Info Contacto", icon: Info },
  { id: "history", label: "Historial", icon: History },
  { id: "notes", label: "Notas rápidas", icon: NotebookText },
  { id: "attachments", label: "Adjuntos", icon: Paperclip },
  { id: "appointments", label: "Agendar Cita", icon: CalendarClock },
  { id: "opportunity", label: "Crear/Ver Oportunidad ($)", icon: DollarSign },
];

interface ContactContextPanelProps {
  contact: Contact | undefined;
  conversation: Conversation | null;
}

export function ContactContextPanel({ contact, conversation }: ContactContextPanelProps) {
  const [tab, setTab] = useState<ContextTab>("info");

  return (
    <section aria-label="Inspector del contacto" className="flex h-full min-h-0 gap-0 overflow-hidden rounded-2xl border border-adlive-border bg-white">
      {/* Contenido de la pestaña activa */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {contact ? (
          <>
            {tab === "info" ? <ContextInfoPanel contact={contact} /> : null}
            {tab === "history" ? <ContextHistoryPanel contact={contact} /> : null}
            {tab === "notes" ? <ContextNotesPanel contact={contact} /> : null}
            {tab === "attachments" ? <ContextAttachmentsPanel conversation={conversation} /> : null}
            {tab === "appointments" ? <ContextAppointmentsPanel contact={contact} /> : null}
            {tab === "opportunity" ? <ContextOpportunityPanel contact={contact} /> : null}
          </>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-adlive-text-muted">
            Selecciona una conversación para ver el contexto del contacto.
          </p>
        )}
      </div>

      {/* Barra vertical extrema derecha de íconos conmutables */}
      <nav aria-label="Secciones del contacto" className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-adlive-border bg-adlive-canvas-bg/50 py-3">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                isActive ? "bg-adlive-primary text-adlive-text-inverse" : "text-adlive-text-muted hover:bg-adlive-primary-light hover:text-adlive-primary"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </button>
          );
        })}
      </nav>
    </section>
  );
}
