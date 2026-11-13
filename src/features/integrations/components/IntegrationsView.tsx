"use client";

/**
 * M8 — Integraciones (`/integraciones`).
 * Banner de configuración a nivel de plataforma y grid de 6 tarjetas
 * interactivas conectadas a la bóveda del store (mock de credenciales cifradas).
 */

import { Info } from "lucide-react";
import { useState } from "react";

import { useCrm } from "@/shared/services/crmStore";
import type { IntegrationProvider } from "@/shared/types/database";

import { IntegrationCard } from "./IntegrationCard";
import { IntegrationModal } from "./IntegrationModal";
import { INTEGRATION_SPECS, type IntegrationSpec } from "./integrationsData";

export function IntegrationsView() {
  const { integrations, setIntegrationConnected } = useCrm();
  const [modalSpec, setModalSpec] = useState<IntegrationSpec | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const findIntegration = (provider: IntegrationProvider) =>
    integrations.find((integration) => integration.provider === provider);

  const handleSave = (provider: IntegrationProvider, values: Record<string, string>) => {
    setIntegrationConnected(provider, true);
    const spec = INTEGRATION_SPECS.find((s) => s.provider === provider);
    setAnnouncement(
      `${spec?.name ?? "Integración"} conectada correctamente. Las credenciales quedaron cifradas en el servidor.`,
    );
    void values; // Los valores viajan a la bóveda del servidor; aquí nunca se persisten.
  };

  const handleDisconnect = (provider: IntegrationProvider) => {
    setIntegrationConnected(provider, false);
    const spec = INTEGRATION_SPECS.find((s) => s.provider === provider);
    setAnnouncement(`${spec?.name ?? "Integración"} desconectada.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Integraciones</h1>
        <p className="mt-1 text-sm text-adlive-text-muted">
          Conecta los canales y plataformas de pauta de tu agencia.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-adlive-cyan/30 bg-gradient-to-r from-adlive-cyan-light to-white px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-adlive-text-main">Configuración a nivel de plataforma</h2>
          <p className="mt-0.5 text-sm leading-6 text-adlive-text-muted">
            Estas integraciones aplican a toda la cuenta de la agencia. Las credenciales se cifran en el
            servidor (AES-256-GCM) y nunca se envían al navegador ni se vuelven a mostrar después de guardarlas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Proveedores disponibles">
        {INTEGRATION_SPECS.map((spec) => (
          <div key={spec.provider} role="listitem">
            <IntegrationCard
              spec={spec}
              integration={findIntegration(spec.provider)}
              voiceEnabled={voiceEnabled}
              onConfigure={() => setModalSpec(spec)}
              onToggleVoice={() => {
                setVoiceEnabled((prev) => {
                  setAnnouncement(prev ? "Llamadas de voz desactivadas para WhatsApp." : "Llamadas de voz activadas para WhatsApp.");
                  return !prev;
                });
              }}
              onDisconnect={() => handleDisconnect(spec.provider)}
            />
          </div>
        ))}
      </div>

      <IntegrationModal open={modalSpec !== null} spec={modalSpec} onClose={() => setModalSpec(null)} onSave={handleSave} />
    </div>
  );
}
