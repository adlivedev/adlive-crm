"use client";

import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBotProvider } from "@/shared/types/database";

import { type AiProviderSpec } from "./botsData";

export interface AiProviderKeyModalProps {
  spec: AiProviderSpec | null;
  open: boolean;
  onClose: () => void;
  onKeySaved: (provider: AiBotProvider, masked: string) => void;
}

/** Modal de configuración de API Key extraído de AiProviderCard para poder
 *  abrirlo también desde NewBotModal («Configurar API Key primero», QA-005). */
export function AiProviderKeyModal({ spec, open, onClose, onKeySaved }: AiProviderKeyModalProps) {
  const { activeTenant } = useCrm();
  const [keyInput, setKeyInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTenant || !spec) return;
    setIsSaving(true); setError(null);
    try {
      const response = await fetch("/api/v1/ai-bots/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: activeTenant.id, provider: spec.provider, apiKey: keyInput }) });
      const result = await response.json() as { error?: string; masked_key?: string };
      if (!response.ok || !result.masked_key) throw new Error(result.error ?? "No se pudo guardar la API key.");
      onKeySaved(spec.provider, result.masked_key);
      onClose(); setKeyInput("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la API key."); }
    finally { setIsSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={spec ? `API Key de ${spec.name}` : "API Key"} subtitle="Se cifra en el servidor y nunca se devuelve al navegador.">
      <form onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-4">
        <Input label="API Key" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder={spec?.keyPlaceholder} type="password" autoComplete="off" required minLength={8} />
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" isLoading={isSaving} disabled={keyInput.trim().length < 8}>Guardar en servidor</Button></div>
      </form>
    </Modal>
  );
}
