"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";

import { useCrm } from "@/shared/services/crmStore";
import type { IntegrationProvider } from "@/shared/types/database";
import { IntegrationCard } from "./IntegrationCard";
import { IntegrationModal } from "./IntegrationModal";
import { INTEGRATION_SPECS, type IntegrationSpec } from "./integrationsData";

const WEBHOOK_PROVIDERS: Record<IntegrationProvider, string> = {
  whatsapp_cloud_api: "whatsapp", facebook_lead_ads: "facebook-leads", instagram: "instagram",
  tiktok_ads: "tiktok-ads", twilio: "twilio", telnyx: "telnyx",
};

export function IntegrationsView() {
  const { integrations, setIntegrationConnected, activeTenant, activeMember, refreshData } = useCrm();
  const [modalSpec, setModalSpec] = useState<IntegrationSpec | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const canManage = activeMember?.role === "owner" || activeMember?.role === "admin";
  const findIntegration = (provider: IntegrationProvider) => integrations.find((integration) => integration.provider === provider);

  const handleSave = async (provider: IntegrationProvider, values: Record<string, string>) => {
    await setIntegrationConnected(provider, true, values);
    const spec = INTEGRATION_SPECS.find((item) => item.provider === provider);
    setAnnouncement(`${spec?.name ?? "Integración"} conectada correctamente para este workspace.`);
  };
  const handleDisconnect = async (provider: IntegrationProvider) => {
    try {
      await setIntegrationConnected(provider, false);
      const spec = INTEGRATION_SPECS.find((item) => item.provider === provider);
      setAnnouncement(`${spec?.name ?? "Integración"} desconectada.`);
    } catch (error) { setAnnouncement(error instanceof Error ? error.message : "No se pudo desconectar la integración."); }
  };
  const handleTest = async (provider: IntegrationProvider): Promise<string> => {
    if (!activeTenant) throw new Error("No hay un workspace activo.");
    const response = await fetch("/api/v1/integrations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: activeTenant.id, provider, action: "test" }),
    });
    const result = await response.json() as { error?: string; message?: string };
    if (!response.ok) throw new Error(result.error ?? "No se pudo probar la conexión.");
    return result.message ?? "La conexión respondió correctamente.";
  };
  const handleRegenerate = async (provider: IntegrationProvider): Promise<string> => {
    if (!activeTenant) throw new Error("No hay un workspace activo.");
    const response = await fetch("/api/v1/integrations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: activeTenant.id, provider, action: "regenerate-verify-token" }),
    });
    const result = await response.json() as { error?: string; verify_token?: string };
    if (!response.ok || !result.verify_token) throw new Error(result.error ?? "No se pudo regenerar el token.");
    await refreshData();
    return result.verify_token;
  };
  const webhookUrl = modalSpec && activeTenant && origin
    ? `${origin}/api/v1/${activeTenant.id}/${WEBHOOK_PROVIDERS[modalSpec.provider]}/webhooks` : "";

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <header><h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Integraciones</h1><p className="mt-1 text-sm text-adlive-text-muted">Conecta los canales y plataformas de pauta de esta empresa.</p></header>
      <div className="flex items-start gap-3 rounded-2xl border border-adlive-cyan/30 bg-gradient-to-r from-adlive-cyan-light to-white px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
        <div><h2 className="text-sm font-semibold text-adlive-text-main">Configuración independiente por empresa</h2><p className="mt-0.5 text-sm leading-6 text-adlive-text-muted">Cada workspace tiene sus propias credenciales, tokens y URLs de webhook. Todo secreto se cifra en el servidor con AES-256-GCM y nunca se devuelve al navegador.</p></div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Proveedores disponibles">
        {INTEGRATION_SPECS.map((spec) => <div key={spec.provider} role="listitem"><IntegrationCard spec={spec} integration={findIntegration(spec.provider)} onConfigure={() => setModalSpec(spec)} onDisconnect={() => void handleDisconnect(spec.provider)} /></div>)}
      </div>
      <IntegrationModal open={modalSpec !== null} spec={modalSpec} integration={modalSpec ? findIntegration(modalSpec.provider) : undefined}
        webhookUrl={webhookUrl} canManage={canManage} onClose={() => setModalSpec(null)} onSave={handleSave} onTest={handleTest} onRegenerate={handleRegenerate} />
    </div>
  );
}
