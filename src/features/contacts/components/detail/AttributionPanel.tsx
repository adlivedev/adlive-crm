"use client";

/**
 * M3 — Acordeón `Atribución`: datos UTM de origen del lead
 * (utm_source, utm_medium, utm_campaign, utm_term, fbclid y landing).
 * Si el contacto no tiene origen registrado muestra el estado vacío.
 */

import { Crosshair } from "lucide-react";

import type { Contact } from "@/shared/types/database";

import { Accordion } from "./Accordion";

export function AttributionPanel({ contact }: { contact: Contact }) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "utm_source", value: contact.utm_source },
    { label: "utm_medium", value: contact.utm_medium },
    { label: "utm_campaign", value: contact.utm_campaign },
    { label: "utm_term", value: contact.utm_term },
    { label: "fbclid", value: contact.fbclid },
    { label: "landing_url", value: contact.landing_url },
  ];
  const hasData = rows.some((row) => row.value !== null && row.value !== "");

  return (
    <Accordion title="Atribución" subtitle="Origen publicitario del lead (UTM)">
      {hasData ? (
        <dl className="flex flex-col gap-2.5">
          {rows
            .filter((row) => row.value !== null && row.value !== "")
            .map((row) => (
              <div key={row.label}>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-adlive-text-muted">{row.label}</dt>
                <dd className="mt-0.5 break-all text-sm text-adlive-text-main">{row.value}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="flex items-start gap-2 text-sm text-adlive-text-muted">
          <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-adlive-text-muted" aria-hidden />
          Sin datos de origen todavía. Se capturan automáticamente cuando el lead llega por formulario web o anuncios.
        </p>
      )}
    </Accordion>
  );
}
