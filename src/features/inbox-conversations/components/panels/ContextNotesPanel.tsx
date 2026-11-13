"use client";

/**
 * M5 — Pestaña «Notas rápidas»: notas internas de la ficha 360° con alta inmediata.
 */

import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

export function ContextNotesPanel({ contact }: { contact: Contact }) {
  const { notes, addContactNote } = useCrm();
  const [draft, setDraft] = useState("");
  const contactNotes = notes
    .filter((note) => note.contact_id === contact.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const handleSave = () => {
    const content = draft.trim();
    if (!content) return;
    addContactNote(contact.id, content);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-adlive-text-muted">Notas rápidas</h4>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="ctx-note" className="sr-only">
          Escribir nota interna
        </label>
        <textarea
          id="ctx-note"
          name="note"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe una nota interna para el equipo…"
          className="w-full resize-none rounded-xl border border-adlive-border bg-white px-3 py-2 text-xs leading-5 text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()} className="self-end">
          Guardar nota
        </Button>
      </form>

      {contactNotes.length === 0 ? (
        <p className="py-4 text-center text-xs text-adlive-text-muted">Aún no hay notas para este contacto.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contactNotes.map((note) => (
            <li key={note.id} className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-3 py-2.5">
              <p className="text-xs leading-5 text-adlive-text-main">{note.content}</p>
              <p className="mt-1 text-[10px] text-adlive-text-muted">{formatRelativeTime(note.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
