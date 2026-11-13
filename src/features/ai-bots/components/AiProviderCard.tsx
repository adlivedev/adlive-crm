"use client";

/**
 * M9 — Tarjeta de proveedor de IA con modal para guardar la API key enmascarada.
 * La key se captura en memoria y solo persiste su versión enmascarada en el
 * estado local (la real viaja a la tabla protegida del servidor en Etapa B).
 */

import { Bot, Check } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import type { AiBotProvider } from "@/shared/types/database";

import { maskApiKey, type AiProviderSpec } from "./botsData";

export interface AiProviderCardProps {
  spec: AiProviderSpec;
  onKeySaved: (provider: AiBotProvider, masked: string) => void;
}

export function AiProviderCard({ spec, onKeySaved }: AiProviderCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [savedMasked, setSavedMasked] = useState<string | null>(null);
  const isIntegrated = spec.provider === "integrated";

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const masked = maskApiKey(keyInput, spec.keyPrefix);
    setSavedMasked(masked);
    onKeySaved(spec.provider, masked);
    setModalOpen(false);
    setKeyInput("");
  };

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-adlive-primary-light text-adlive-primary">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <Badge tone={isIntegrated ? "success" : savedMasked ? "cyan" : "neutral"}>
            {isIntegrated ? "Activa" : savedMasked ? "Key guardada" : "Sin configurar"}
          </Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-adlive-text-main">{spec.name}</h3>
          <p className="mt-1 text-sm leading-6 text-adlive-text-muted">{spec.description}</p>
        </div>
        {savedMasked ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-adlive-success">
            <Check className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono">{savedMasked}</span>
          </p>
        ) : null}
        {!isIntegrated ? (
          <Button size="sm" variant={savedMasked ? "secondary" : "primary"} className="mt-auto" onClick={() => setModalOpen(true)}>
            {savedMasked ? "Actualizar API Key" : "Configurar API Key"}
          </Button>
        ) : null}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`API Key de ${spec.name}`}
        subtitle="Se guarda en una tabla protegida del servidor: nunca se envía al navegador ni se muestra de nuevo."
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="API Key"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder={spec.keyPlaceholder}
            type="password"
            autoComplete="off"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={keyInput.trim().length < 8}>
              Guardar en servidor
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
