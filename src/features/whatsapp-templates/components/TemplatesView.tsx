"use client";

/**
 * M7 — Plantillas de WhatsApp Business (`/plantillas`).
 * Cabecera con sincronización simulada contra Meta Cloud API, tabla de
 * plantillas del store y modal de creación con vista previa en vivo.
 */

import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";

import { CreateTemplateModal } from "./CreateTemplateModal";
import { TemplatesTable } from "./TemplatesTable";

const SYNC_DURATION_MS = 1800;

export function TemplatesView() {
  const { templates, deleteWhatsappTemplate, integrations } = useCrm();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const syncTimeout = useRef<number | null>(null);

  const whatsappConnected = integrations.some(
    (integration) => integration.provider === "whatsapp_cloud_api" && integration.is_connected,
  );

  useEffect(() => {
    return () => {
      if (syncTimeout.current !== null) window.clearTimeout(syncTimeout.current);
    };
  }, []);

  const handleSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setAnnouncement("Sincronizando plantillas con Meta Cloud API…");
    syncTimeout.current = window.setTimeout(() => {
      setIsSyncing(false);
      setLastSync(new Date());
      setAnnouncement(`Sincronización completada: ${templates.length} plantillas al día con Meta Cloud API.`);
    }, SYNC_DURATION_MS);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Plantillas de WhatsApp</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">
            Plantillas de la cuenta de WhatsApp Business conectada en Integraciones
            {whatsappConnected ? " · conectada" : ""}.
          </p>
          {lastSync ? (
            <p className="mt-0.5 text-xs text-adlive-text-muted">
              Última sincronización:{" "}
              {lastSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleSync} disabled={isSyncing} aria-busy={isSyncing}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden />
            {isSyncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Crear plantilla
          </Button>
        </div>
      </header>

      <TemplatesTable templates={templates} onDelete={deleteWhatsappTemplate} />

      <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
