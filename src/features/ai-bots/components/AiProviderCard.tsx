"use client";

import { Bot, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBotProvider } from "@/shared/types/database";

import { type AiProviderSpec } from "./botsData";

export interface AiProviderCardProps { spec: AiProviderSpec; onKeySaved: (provider: AiBotProvider, masked: string) => void }

export function AiProviderCard({ spec, onKeySaved }: AiProviderCardProps) {
  const { activeTenant } = useCrm();
  const [modalOpen, setModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [savedMasked, setSavedMasked] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIntegrated = spec.provider === "integrated";

  useEffect(() => {
    if (!activeTenant || isIntegrated) return;
    void fetch(`/api/v1/ai-bots/providers?tenantId=${activeTenant.id}`).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { providers: Array<{ provider: string; is_connected: boolean; masked_key: string | null }> };
      const current = result.providers.find((item) => item.provider === spec.provider && item.is_connected);
      setSavedMasked(current?.masked_key ?? null);
    }).catch(() => setSavedMasked(null));
  }, [activeTenant, isIntegrated, spec.provider]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTenant) return;
    setIsSaving(true); setError(null);
    try {
      const response = await fetch("/api/v1/ai-bots/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: activeTenant.id, provider: spec.provider, apiKey: keyInput }) });
      const result = await response.json() as { error?: string; masked_key?: string };
      if (!response.ok || !result.masked_key) throw new Error(result.error ?? "No se pudo guardar la API key.");
      setSavedMasked(result.masked_key); onKeySaved(spec.provider, result.masked_key);
      setModalOpen(false); setKeyInput("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la API key."); }
    finally { setIsSaving(false); }
  };

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-adlive-primary-light text-adlive-primary"><Bot className="h-5 w-5" aria-hidden /></span><Badge tone={savedMasked ? "cyan" : "neutral"}>{isIntegrated ? "Según plataforma" : savedMasked ? "Key guardada" : "Sin configurar"}</Badge></div>
        <div><h3 className="text-sm font-semibold text-adlive-text-main">{spec.name}</h3><p className="mt-1 text-sm leading-6 text-adlive-text-muted">{spec.description}</p></div>
        {savedMasked ? <p className="flex items-center gap-1.5 text-xs font-medium text-adlive-success"><Check className="h-3.5 w-3.5" aria-hidden /><span className="font-mono">{savedMasked}</span></p> : null}
        {!isIntegrated ? <Button size="sm" variant={savedMasked ? "secondary" : "primary"} className="mt-auto" onClick={() => setModalOpen(true)}>{savedMasked ? "Actualizar API Key" : "Configurar API Key"}</Button> : null}
      </Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`API Key de ${spec.name}`} subtitle="Se cifra en el servidor y nunca se devuelve al navegador.">
        <form onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-4">
          <Input label="API Key" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder={spec.keyPlaceholder} type="password" autoComplete="off" required minLength={8} />
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" isLoading={isSaving} disabled={keyInput.trim().length < 8}>Guardar en servidor</Button></div>
        </form>
      </Modal>
    </>
  );
}
