"use client";

/**
 * Panel de identidad del contacto (Fase 1): lista todos los teléfonos y
 * correos registrados (contact_phones / contact_emails, poblados por la
 * deduplicación estilo HubSpot) con su estado Principal / Secundario y permite
 * promover cualquiera a principal en 1 clic (Dueño/Admin/Agente con acceso
 * al contacto vía RLS).
 */

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { createClient } from "@/shared/lib/supabase/client";
import type { Contact } from "@/shared/types/database";

interface IdentityRow { id: string; value: string; is_primary: boolean; source: string | null }

export function ContactIdentityPanel({ contact }: { contact: Contact }) {
  const [phones, setPhones] = useState<IdentityRow[]>([]);
  const [emails, setEmails] = useState<IdentityRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reload = () => {
    const supabase = createClient();
    void supabase.from("contact_phones").select("id,phone_e164,is_primary,source").eq("contact_id", contact.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setPhones((data ?? []).map((row) => ({ id: row.id, value: row.phone_e164, is_primary: row.is_primary, source: row.source }))));
    void supabase.from("contact_emails").select("id,email,is_primary,source").eq("contact_id", contact.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEmails((data ?? []).map((row) => ({ id: row.id, value: row.email, is_primary: row.is_primary, source: row.source }))));
  };

  useEffect(reload, [contact.id]);

  /* Promover a principal: actualiza la columna del contacto y los flags. */
  const makePrimary = async (kind: "phone" | "email", row: IdentityRow) => {
    setFeedback(null);
    const supabase = createClient();
    const table = kind === "phone" ? "contact_phones" : "contact_emails";
    const column = kind === "phone" ? "phone_e164" : "email";
    await supabase.from(table).update({ is_primary: false }).eq("contact_id", contact.id);
    const { error: flagError } = await supabase.from(table).update({ is_primary: true }).eq("id", row.id);
    if (flagError) { setFeedback(`No se pudo promover: ${flagError.message}`); return; }
    const { error: contactError } = await supabase.from("contacts").update({ [column]: row.value }).eq("id", contact.id);
    if (contactError) { setFeedback(`No se pudo promover: ${contactError.message}`); return; }
    setFeedback(kind === "phone" ? `Teléfono ${row.value} ahora es el principal.` : `Correo ${row.value} ahora es el principal.`);
    reload();
  };

  const renderRow = (kind: "phone" | "email", row: IdentityRow) => (
    <li key={row.id} className="flex items-center gap-2 rounded-lg border border-adlive-border bg-white px-3 py-2">
      <span className={`min-w-0 flex-1 truncate text-sm ${kind === "phone" ? "font-mono" : ""} text-adlive-text-main`}>{row.value}</span>
      {row.is_primary
        ? <Badge tone="success">Principal</Badge>
        : (
          <button
            type="button"
            onClick={() => void makePrimary(kind, row)}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-adlive-border px-2 py-1 text-[11px] font-medium text-adlive-text-muted transition-colors hover:border-adlive-primary hover:text-adlive-primary"
          >
            <Star className="h-3 w-3" aria-hidden /> Hacer principal
          </button>
        )}
    </li>
  );

  if (phones.length === 0 && emails.length === 0) return null;

  return (
    <section aria-label="Identidad del contacto" className="rounded-2xl border border-adlive-border bg-adlive-canvas-bg/40 p-4">
      <h3 className="text-sm font-semibold text-adlive-text-main">Teléfonos y correos</h3>
      {phones.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-adlive-text-muted">Teléfonos</p>
          <ul className="mt-1 flex flex-col gap-1.5">{phones.map((row) => renderRow("phone", row))}</ul>
        </div>
      ) : null}
      {emails.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-adlive-text-muted">Correos</p>
          <ul className="mt-1 flex flex-col gap-1.5">{emails.map((row) => renderRow("email", row))}</ul>
        </div>
      ) : null}
      {feedback ? (
        <p role="status" className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-adlive-success">{feedback}</p>
      ) : null}
    </section>
  );
}
