"use client";

/**
 * M8 — Modal de configuración de una integración.
 * Los secretos se capturan en memoria, se confirman enmascarados y nunca se
 * persisten en el cliente (ISO 27001: la bóveda real vive en el servidor).
 */

import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { IntegrationProvider } from "@/shared/types/database";

import { maskSecret, type IntegrationSpec } from "./integrationsData";

export interface IntegrationModalProps {
  open: boolean;
  spec: IntegrationSpec | null;
  onClose: () => void;
  onSave: (provider: IntegrationProvider, values: Record<string, string>) => void;
}

export function IntegrationModal({ open, spec, onClose, onSave }: IntegrationModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedMasks, setSavedMasks] = useState<Record<string, string>>({});

  if (!spec) return null;

  const handleClose = () => {
    setValues({});
    setSavedMasks({});
    onClose();
  };

  const handleFieldChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const isComplete = spec.fields.every((field) => (values[field.key] ?? "").trim().length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete) return;
    const masks: Record<string, string> = {};
    for (const field of spec.fields) {
      if (field.secret) masks[field.key] = maskSecret(values[field.key] ?? "");
    }
    setSavedMasks(masks);
    onSave(spec.provider, values);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Configurar ${spec.name}`} subtitle="Las credenciales se cifran en el servidor y nunca se muestran de nuevo.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {spec.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Input
              label={field.label}
              value={values[field.key] ?? ""}
              onChange={(event) => handleFieldChange(field.key, event.target.value)}
              placeholder={field.placeholder}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              hint={field.hint}
            />
            {field.secret && savedMasks[field.key] ? (
              <p className="text-xs font-medium text-adlive-success">
                Guardada: <span className="font-mono">{savedMasks[field.key]}</span>
              </p>
            ) : null}
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isComplete}>
            Guardar y conectar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
