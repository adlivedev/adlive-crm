"use client";

/**
 * M3 — Ficha 360° del Contacto (`/contactos/[id]`).
 *
 * Layout de 3 columnas:
 *  - Izquierda: acordeones Datos del contacto · Atribución · Campos
 *    personalizados · Oportunidades.
 *  - Central: Conversación de WhatsApp con el validador estricto de la
 *    ventana de 24 h de Meta.
 *  - Derecha: Gestión comercial con pestañas Notas · Tareas · Empresas ·
 *    Documentos · Citas.
 */

import { ArrowLeft, UserRound } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { useCrm } from "@/shared/services/crmStore";

import { AttributionPanel } from "./AttributionPanel";
import { CommercialTabs } from "./CommercialTabs";
import { ContactDataPanel } from "./ContactDataPanel";
import { ConversationPanel } from "./ConversationPanel";
import { CustomFieldsPanel } from "./CustomFieldsPanel";
import { OpportunitiesPanel } from "./OpportunitiesPanel";
import { formatPhone } from "../contactsUtils";

export function ContactDetailView({ contactId }: { contactId: string }) {
  const { contacts, conversations } = useCrm();
  const contact = contacts.find((item) => item.id === contactId) ?? null;

  if (!contact) {
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 px-8 py-14 text-center">
        <UserRound className="h-10 w-10 text-adlive-text-muted" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold text-adlive-text-main">Contacto no encontrado</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">
            El contacto solicitado no existe en la cuenta activa o fue eliminado.
          </p>
        </div>
        <Link
          href="/contactos"
          className="inline-flex items-center gap-1.5 rounded-xl bg-adlive-primary px-4 py-2.5 text-sm font-semibold text-adlive-text-inverse transition-colors hover:bg-adlive-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a Contactos
        </Link>
      </Card>
    );
  }

  const conversation = conversations.find((item) => item.contact_id === contact.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <header>
        <Link
          href="/contactos"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-adlive-primary transition-colors hover:bg-adlive-primary-light"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-adlive-text-main">{contact.full_name}</h1>
          <Badge tone={contact.is_closed_client ? "success" : "primary"}>
            {contact.is_closed_client ? "Cliente cerrado" : "En seguimiento"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-adlive-text-muted">
          Ficha completa del contacto ·{" "}
          <span className="font-mono text-[13px]">{formatPhone(contact.phone_e164)}</span>
          {contact.email ? ` · ${contact.email}` : ""}
        </p>
        {contact.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Etiquetas del contacto">
            {contact.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      {/* 3 columnas */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <ContactDataPanel contact={contact} />
          <AttributionPanel contact={contact} />
          <CustomFieldsPanel contact={contact} />
          <OpportunitiesPanel contact={contact} />
        </div>
        <ConversationPanel contact={contact} conversation={conversation} />
        <CommercialTabs contact={contact} />
      </div>
    </div>
  );
}
