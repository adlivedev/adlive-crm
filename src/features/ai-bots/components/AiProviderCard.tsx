"use client";

import { Bot, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBotProvider } from "@/shared/types/database";

import { type AiProviderSpec } from "./botsData";
import { AiProviderKeyModal } from "./AiProviderKeyModal";

export interface AiProviderCardProps { spec: AiProviderSpec; onKeySaved: (provider: AiBotProvider, masked: string) => void }

export function AiProviderCard({ spec, onKeySaved }: AiProviderCardProps) {
  const { activeTenant } = useCrm();
  const [modalOpen, setModalOpen] = useState(false);
  const [savedMasked, setSavedMasked] = useState<string | null>(null);
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

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-adlive-primary-light text-adlive-primary"><Bot className="h-5 w-5" aria-hidden /></span><Badge tone={savedMasked ? "cyan" : "neutral"}>{isIntegrated ? "Según plataforma" : savedMasked ? "Key guardada" : "Sin configurar"}</Badge></div>
        <div><h3 className="text-sm font-semibold text-adlive-text-main">{spec.name}</h3><p className="mt-1 text-sm leading-6 text-adlive-text-muted">{spec.description}</p></div>
        {savedMasked ? <p className="flex items-center gap-1.5 text-xs font-medium text-adlive-success"><Check className="h-3.5 w-3.5" aria-hidden /><span className="font-mono">{savedMasked}</span></p> : null}
        {!isIntegrated ? <Button size="sm" variant={savedMasked ? "secondary" : "primary"} className="mt-auto" onClick={() => setModalOpen(true)}>{savedMasked ? "Actualizar API Key" : "Configurar API Key"}</Button> : null}
      </Card>
      <AiProviderKeyModal spec={spec} open={modalOpen} onClose={() => setModalOpen(false)} onKeySaved={onKeySaved} />
    </>
  );
}
