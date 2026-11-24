"use client";

/**
 * Modal `Crear workflow` (M6): nombre, disparador y descripción inicial.
 * El flujo nace en Draft con lienzo vacío y se construye en el interior.
 */

import { MessageCircleHeart, UsersRound } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { WorkflowTriggerType } from "@/shared/types/database";

import { TRIGGER_OPTIONS } from "./workflowUtils";

interface CreateWorkflowModalProps {
  open: boolean;
  onClose: () => void;
}

const RECOMMENDED_TEMPLATES = [
  {
    variant: "bienvenida" as const,
    icon: MessageCircleHeart,
    title: "Bienvenida automática de formulario + Aviso de asesor",
    detail: "Contacto creado / Formulario → Enviar plantilla WhatsApp → Mover a Interesado → Asignar Round Robin.",
  },
  {
    variant: "reparto" as const,
    icon: UsersRound,
    title: "Reparto equitativo entre agentes activos (Round Robin)",
    detail: "Mensaje recibido en WhatsApp → Marcar seguimiento → Asignar equitativamente entre agentes activos.",
  },
];

export function CreateWorkflowModal({ open, onClose }: CreateWorkflowModalProps) {
  const { createWorkflow, createWorkflowTemplate } = useCrm();
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("manual_enrollment");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleClose = () => {
    setName("");
    setTriggerType("manual_enrollment");
    setDescription("");
    setError("");
    onClose();
  };

  const handleSubmit = () => {
    if (name.trim().length < 2) {
      setError("El nombre del workflow debe tener al menos 2 caracteres.");
      return;
    }
    createWorkflow({ name, description: description.trim() || null, trigger_type: triggerType });
    handleClose();
  };

  const handleTemplate = (variant: "bienvenida" | "reparto") => {
    createWorkflowTemplate(variant);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Crear workflow" subtitle="Elige una plantilla recomendada en 1 clic o créalo desde cero.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-adlive-text-main">Plantillas recomendadas</p>
          {RECOMMENDED_TEMPLATES.map((template) => (
            <button
              key={template.variant}
              type="button"
              onClick={() => handleTemplate(template.variant)}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-adlive-border bg-white px-4 py-3 text-left transition-all duration-150 hover:border-adlive-primary hover:bg-adlive-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary"
            >
              <template.icon className="mt-0.5 h-5 w-5 shrink-0 text-adlive-primary" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-adlive-text-main">{template.title}</span>
                <span className="mt-0.5 block text-xs text-adlive-text-muted">{template.detail}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-adlive-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-adlive-text-muted">o desde cero</span>
          <span className="h-px flex-1 bg-adlive-border" />
        </div>

        <Input
          label="Nombre del workflow"
          placeholder="Ej. Difusión oferta diciembre"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="workflow-trigger" className="text-sm font-medium text-adlive-text-main">
            Disparador
          </label>
          <select
            id="workflow-trigger"
            value={triggerType}
            onChange={(event) => setTriggerType(event.target.value as WorkflowTriggerType)}
            className="h-11 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          >
            {TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-adlive-text-muted">Define cuándo se inscribe automáticamente un contacto.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="workflow-description" className="text-sm font-medium text-adlive-text-main">
            Descripción
          </label>
          <textarea
            id="workflow-description"
            rows={3}
            maxLength={280}
            placeholder="¿Qué automatiza este flujo?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full resize-none rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit">Crear workflow</Button>
        </div>
      </form>
    </Modal>
  );
}
