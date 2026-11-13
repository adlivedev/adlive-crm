"use client";

/**
 * M8 — Tarjeta interactiva de un proveedor de integración.
 */

import { PhoneCall } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import type { TenantIntegrationVault } from "@/shared/types/database";

import type { IntegrationSpec } from "./integrationsData";

export interface IntegrationCardProps {
  spec: IntegrationSpec;
  integration: TenantIntegrationVault | undefined;
  voiceEnabled: boolean;
  onConfigure: () => void;
  onToggleVoice: () => void;
  onDisconnect: () => void;
}

export function IntegrationCard({ spec, integration, voiceEnabled, onConfigure, onToggleVoice, onDisconnect }: IntegrationCardProps) {
  const Icon = spec.icon;
  const connected = integration?.is_connected ?? false;
  const isWhatsapp = spec.provider === "whatsapp_cloud_api";
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-adlive-primary-light text-adlive-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-adlive-text-main">{spec.name}</h3>
            <Badge tone={connected ? "success" : "neutral"} className="mt-1">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-adlive-success" : "bg-adlive-text-muted"}`} aria-hidden />
              {connected ? "Conectado" : "No conectado"}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-sm leading-6 text-adlive-text-muted">{spec.description}</p>

      {isWhatsapp && connected && integration ? (
        <dl className="flex flex-col gap-1 rounded-xl bg-adlive-canvas-bg px-4 py-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-adlive-text-muted">Línea</dt>
            <dd className="font-mono font-medium text-adlive-text-main">{integration.public_metadata.phone_number ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-adlive-text-muted">WABA ID</dt>
            <dd className="font-mono font-medium text-adlive-text-main">{integration.public_metadata.waba_id ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-adlive-text-muted">Llamadas de voz</dt>
            <dd>
              <Badge tone={voiceEnabled ? "cyan" : "neutral"}>{voiceEnabled ? "Activas" : "Inactivas"}</Badge>
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button size="sm" variant="secondary" onClick={onConfigure}>
              {isWhatsapp ? "Reconectar" : "Gestionar"}
            </Button>
            {isWhatsapp ? (
              <Button size="sm" variant="secondary" onClick={onToggleVoice} aria-pressed={voiceEnabled}>
                <PhoneCall className="h-4 w-4" aria-hidden />
                {voiceEnabled ? "Desactivar llamadas" : "Activar llamadas"}
              </Button>
            ) : null}
            {confirmDisconnect ? (
              <>
                <Button size="sm" variant="danger" onClick={onDisconnect}>
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="text-adlive-danger hover:text-adlive-danger" onClick={() => setConfirmDisconnect(true)}>
                Desconectar
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" onClick={onConfigure}>
            Conectar
          </Button>
        )}
      </div>
    </Card>
  );
}
