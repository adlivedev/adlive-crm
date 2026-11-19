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

import { type IntegrationSpec } from "./integrationsData";

export interface IntegrationModalProps {
  open: boolean;
  spec: IntegrationSpec | null;
  onClose: () => void;
  onSave: (provider: IntegrationProvider, values: Record<string, string>) => Promise<void>;
}

export function IntegrationModal({ open, spec, onClose, onSave }: IntegrationModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!spec) return null;

  const handleClose = () => {
    if (isSaving) return;
    setValues({});
    setError(null);
    onClose();
  };

  const handleFieldChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const isComplete = spec.fields.every((field) => (values[field.key] ?? "").trim().length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(spec.provider, values);
      setValues({});
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la integración.");
    } finally {
      setIsSaving(false);
    }
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
          </div>
        ))}
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isComplete || isSaving} isLoading={isSaving}>
            Guardar y conectar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
