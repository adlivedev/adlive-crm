"use client";

/**
 * Pestaña Settings (M6): tarjeta de configuración del workflow con nombre,
 * descripción, regla de re-inscripción y botón guardar.
 */

import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow } from "@/shared/types/database";

interface SettingsTabProps {
  workflow: Workflow;
  onSaved: () => void;
}

export function SettingsTab({ workflow, onSaved }: SettingsTabProps) {
  const { updateWorkflow } = useCrm();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [allowReenrollment, setAllowReenrollment] = useState(workflow.allow_reenrollment);
  const [feedback, setFeedback] = useState("");

  const handleSave = () => {
    if (name.trim().length < 2) {
      setFeedback("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    updateWorkflow(workflow.id, {
      name: name.trim(),
      description: description.trim() || null,
      allow_reenrollment: allowReenrollment,
    });
    setFeedback("Configuración guardada correctamente.");
    onSaved();
  };

  return (
    <Card className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-6">
      <div>
        <h2 className="text-base font-semibold text-adlive-text-main">Configuración del workflow</h2>
        <p className="mt-0.5 text-sm text-adlive-text-muted">
          Identidad del flujo y reglas de inscripción de contactos.
        </p>
      </div>

      <Input
        label="Nombre del workflow"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setFeedback("");
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="workflow-settings-description" className="text-sm font-medium text-adlive-text-main">
          Descripción
        </label>
        <textarea
          id="workflow-settings-description"
          rows={4}
          maxLength={280}
          placeholder="¿Qué automatiza este flujo?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full resize-none rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <p className="text-xs text-adlive-text-muted">{description.length}/280</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-adlive-text-main">¿Quién puede re-inscribirse?</legend>
        <label
          htmlFor="reenroll-none"
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${
            !allowReenrollment ? "border-adlive-primary bg-adlive-primary-light" : "border-adlive-border hover:border-adlive-primary/40"
          }`}
        >
          <input
            id="reenroll-none"
            type="radio"
            name="reenrollment"
            checked={!allowReenrollment}
            onChange={() => setAllowReenrollment(false)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-adlive-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-adlive-text-main">Nadie: solo se inscribe una vez</span>
            <span className="block text-xs text-adlive-text-muted">Recomendado para difusiones y repartos.</span>
          </span>
        </label>
        <label
          htmlFor="reenroll-many"
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${
            allowReenrollment ? "border-adlive-primary bg-adlive-primary-light" : "border-adlive-border hover:border-adlive-primary/40"
          }`}
        >
          <input
            id="reenroll-many"
            type="radio"
            name="reenrollment"
            checked={allowReenrollment}
            onChange={() => setAllowReenrollment(true)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-adlive-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-adlive-text-main">Permitir re-inscripción múltiples veces</span>
            <span className="block text-xs text-adlive-text-muted">Útil para secuencias de seguimiento recurrentes.</span>
          </span>
        </label>
      </fieldset>

      {feedback ? (
        <p
          role={feedback.includes("correctamente") ? "status" : "alert"}
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            feedback.includes("correctamente")
              ? "border-emerald-200 bg-emerald-50 text-adlive-success"
              : "border-red-200 bg-red-50 text-adlive-danger"
          }`}
        >
          {feedback}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={handleSave}>Guardar</Button>
      </div>
    </Card>
  );
}
