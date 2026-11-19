"use client";

/**
 * M9 — Modal de creación de un bot por producto.
 */

import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { AiBotProvider } from "@/shared/types/database";

import { AI_PROVIDER_SPECS } from "./botsData";

export interface NewBotModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; product_line: string; provider: AiBotProvider; system_prompt: string }) => void;
}

export function NewBotModal({ open, onClose, onCreate }: NewBotModalProps) {
  const [name, setName] = useState("");
  const [productLine, setProductLine] = useState("");
  const [provider, setProvider] = useState<AiBotProvider>("openai");
  const [systemPrompt, setSystemPrompt] = useState("");
  const promptId = "new-bot-system-prompt";

  const isValid =
    name.trim().length >= 3 && productLine.trim().length >= 3 && systemPrompt.trim().length >= 20;

  const handleClose = () => {
    setName("");
    setProductLine("");
    setProvider("openai");
    setSystemPrompt("");
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    onCreate({ name: name.trim(), product_line: productLine.trim(), provider, system_prompt: systemPrompt.trim() });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo bot" subtitle="Define el bot por línea de negocio y su System Prompt.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nombre del bot" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Asistente de bienvenida" />
        <Input
          label="Línea de negocio"
          value={productLine}
          onChange={(event) => setProductLine(event.target.value)}
          placeholder="Ej. Ventas, soporte o servicio al cliente"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-bot-provider" className="text-sm font-medium text-adlive-text-main">
            Proveedor de IA
          </label>
          <select
            id="new-bot-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as AiBotProvider)}
            className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          >
            {AI_PROVIDER_SPECS.filter((spec) => spec.provider !== "integrated").map((spec) => (
              <option key={spec.provider} value={spec.provider}>
                {spec.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={promptId} className="text-sm font-medium text-adlive-text-main">
            System Prompt
          </label>
          <textarea
            id={promptId}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            rows={5}
            placeholder="Instrucciones completas del comportamiento del bot: tono, objetivo comercial, manejo de objeciones y escalado a asesor humano."
            className="w-full resize-y rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
          <p className="text-xs text-adlive-text-muted">{systemPrompt.length} caracteres · mínimo 20</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid}>
            Crear bot
          </Button>
        </div>
      </form>
    </Modal>
  );
}
