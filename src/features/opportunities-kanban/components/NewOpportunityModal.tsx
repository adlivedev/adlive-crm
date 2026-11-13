"use client";

/**
 * Modal de alta de oportunidad (M4): contacto (con buscador), etapa inicial,
 * título del plan móvil y valor en $. Reutiliza el Modal accesible de M3.
 */

import { useMemo, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";
import type { PipelineStage } from "@/shared/types/database";

import { PLAN_TITLE_SUGGESTIONS, normalizeText } from "./kanbanUtils";

export interface NewOpportunityModalProps {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  stages: PipelineStage[];
}

export function NewOpportunityModal({ open, onClose, pipelineId, stages }: NewOpportunityModalProps) {
  const { contacts, createOpportunity, activeMember } = useCrm();

  const [contactQuery, setContactQuery] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    const needle = normalizeText(contactQuery);
    const sorted = [...contacts].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
    if (needle.length === 0) return sorted.slice(0, 30);
    return sorted.filter((contact) => normalizeText(`${contact.full_name} ${contact.phone_e164}`).includes(needle)).slice(0, 30);
  }, [contacts, contactQuery]);

  const handleClose = () => {
    setContactQuery("");
    setContactId("");
    setStageId(stages[0]?.id ?? "");
    setTitle("");
    setValue("");
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const monetaryValue = Number(value);
    if (!contactId) {
      setError("Selecciona el contacto de la oportunidad.");
      return;
    }
    if (!stageId) {
      setError("Selecciona la etapa inicial.");
      return;
    }
    if (title.trim().length < 3) {
      setError("Escribe el título del plan móvil (mínimo 3 caracteres).");
      return;
    }
    if (!Number.isFinite(monetaryValue) || monetaryValue <= 0) {
      setError("Ingresa un valor válido mayor a $0.");
      return;
    }
    const contact = contacts.find((item) => item.id === contactId);
    createOpportunity({
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: title.trim(),
      monetary_value: Math.round(monetaryValue),
      assigned_member_id: contact?.assigned_member_id ?? activeMember?.id ?? null,
    });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nueva oportunidad" subtitle="Registra un plan móvil en el pipeline seleccionado.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="opp-contact-search" className="text-sm font-medium text-adlive-text-main">
            Buscar contacto
          </label>
          <input
            id="opp-contact-search"
            type="search"
            value={contactQuery}
            onChange={(event) => setContactQuery(event.target.value)}
            placeholder="Nombre o teléfono…"
            className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="opp-contact" className="text-sm font-medium text-adlive-text-main">
            Contacto <span aria-hidden className="text-adlive-danger">*</span>
          </label>
          <select
            id="opp-contact"
            required
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          >
            <option value="" disabled>
              Selecciona un contacto…
            </option>
            {filteredContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name} · {contact.phone_e164}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="opp-stage" className="text-sm font-medium text-adlive-text-main">
              Etapa inicial <span aria-hidden className="text-adlive-danger">*</span>
            </label>
            <select
              id="opp-stage"
              required
              value={stageId}
              onChange={(event) => setStageId(event.target.value)}
              className="h-11 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="opp-value" className="text-sm font-medium text-adlive-text-main">
              Valor (COP) <span aria-hidden className="text-adlive-danger">*</span>
            </label>
            <input
              id="opp-value"
              type="number"
              min={1}
              step={500}
              inputMode="numeric"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="38000"
              className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 font-mono text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="opp-title" className="text-sm font-medium text-adlive-text-main">
            Título del plan móvil <span aria-hidden className="text-adlive-danger">*</span>
          </label>
          <input
            id="opp-title"
            list="plan-title-suggestions"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Plan Móvil 50GB - $38.000"
            className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
          <datalist id="plan-title-suggestions">
            {PLAN_TITLE_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-adlive-border pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit">Crear oportunidad</Button>
        </div>
      </form>
    </Modal>
  );
}
