"use client";

/**
 * M5 — Pestaña «Historial»: línea de tiempo de actividades de la ficha 360°.
 */

import { formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

export function ContextHistoryPanel({ contact }: { contact: Contact }) {
  const { activities } = useCrm();
  const contactActivities = activities
    .filter((activity) => activity.contact_id === contact.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-adlive-text-muted">Historial de actividad</h4>
      {contactActivities.length === 0 ? (
        <p className="py-6 text-center text-xs text-adlive-text-muted">Este contacto aún no registra actividad.</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l-2 border-adlive-border pl-4">
          {contactActivities.map((activity) => (
            <li key={activity.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-adlive-primary" aria-hidden />
              <p className="text-xs leading-5 text-adlive-text-main">{activity.description}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-adlive-text-muted">
                {activity.activity_type} · {formatRelativeTime(activity.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
