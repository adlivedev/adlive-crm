"use client";

/**
 * M5 — Pestaña «Agendar Cita»: citas del contacto gestionadas como tareas con
 * fecha/hora (addContactTask). Permite agendar una cita nueva y completar las pendientes.
 */

import { CalendarClock, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { formatDate, formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

export function ContextAppointmentsPanel({ contact }: { contact: Contact }) {
  const { tasks, addContactTask, toggleContactTask } = useCrm();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const contactTasks = tasks
    .filter((task) => task.contact_id === contact.id)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));

  const handleSchedule = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !dueAt) return;
    addContactTask(contact.id, `📅 Cita: ${trimmedTitle}`, new Date(dueAt).toISOString());
    setTitle("");
    setDueAt("");
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-adlive-text-muted">Agendar cita</h4>

      <div className="flex flex-col gap-2 rounded-xl border border-adlive-border p-3">
        <label htmlFor="ctx-cita-title" className="text-[11px] font-medium text-adlive-text-muted">
          Motivo de la cita
        </label>
        <input
          id="ctx-cita-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Llamada de cierre, entrega de SIM…"
          className="h-9 rounded-lg border border-adlive-border bg-white px-2.5 text-xs text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <label htmlFor="ctx-cita-when" className="text-[11px] font-medium text-adlive-text-muted">
          Fecha y hora
        </label>
        <input
          id="ctx-cita-when"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="h-9 rounded-lg border border-adlive-border bg-white px-2.5 text-xs text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <Button type="button" variant="primary" size="sm" onClick={handleSchedule} disabled={!title.trim() || !dueAt} className="self-end">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Agendar cita
        </Button>
      </div>

      {contactTasks.length === 0 ? (
        <p className="py-4 text-center text-xs text-adlive-text-muted">Este contacto no tiene citas ni tareas programadas.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Citas y tareas del contacto">
          {contactTasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2 rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleContactTask(task.id)}
                aria-pressed={task.is_completed}
                aria-label={task.is_completed ? `Marcar «${task.title}» como pendiente` : `Completar «${task.title}»`}
                className={`mt-0.5 cursor-pointer ${task.is_completed ? "text-adlive-success" : "text-adlive-text-muted hover:text-adlive-primary"}`}
              >
                {task.is_completed ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
              </button>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs leading-5 ${task.is_completed ? "text-adlive-text-muted line-through" : "text-adlive-text-main"}`}>
                  {task.title}
                </span>
                {task.due_at ? (
                  <span className="block text-[10px] text-adlive-text-muted">
                    {formatDate(task.due_at)} · {formatTime(task.due_at)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
