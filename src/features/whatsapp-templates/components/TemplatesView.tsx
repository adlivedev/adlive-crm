"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";

import { CreateTemplateModal } from "./CreateTemplateModal";
import { TemplatesTable } from "./TemplatesTable";

export function TemplatesView() {
  const { templates, deleteWhatsappTemplate, integrations, activeTenant, refreshData } = useCrm();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const whatsappConnected = integrations.some((integration) => integration.provider === "whatsapp_cloud_api" && integration.is_connected);

  const handleSync = async () => {
    if (isSyncing || !activeTenant) return;
    setIsSyncing(true); setSyncError(null); setAnnouncement("Sincronizando plantillas con Meta Cloud API…");
    try {
      const response = await fetch("/api/v1/whatsapp/templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: activeTenant.id }) });
      const result = await response.json() as { error?: string; synchronized?: number };
      if (!response.ok) throw new Error(result.error ?? "No se pudo sincronizar.");
      await refreshData();
      setLastSync(new Date());
      setAnnouncement(`Sincronización completada: ${result.synchronized ?? 0} plantillas recibidas de Meta.`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo sincronizar.");
      setAnnouncement("La sincronización falló.");
    } finally { setIsSyncing(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Plantillas de WhatsApp</h1><p className="mt-1 text-sm text-adlive-text-muted">Plantillas de la cuenta de WhatsApp Business conectada en Integraciones{whatsappConnected ? " · conectada" : ""}.</p>{lastSync ? <p className="mt-0.5 text-xs text-adlive-text-muted">Última sincronización: {lastSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</p> : null}</div>
        <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => void handleSync()} disabled={isSyncing || !whatsappConnected} isLoading={isSyncing}><RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden />{isSyncing ? "Sincronizando…" : "Sincronizar"}</Button><Button onClick={() => setShowCreate(true)} disabled={!whatsappConnected}><Plus className="h-4 w-4" aria-hidden />Crear plantilla</Button></div>
      </header>
      {!whatsappConnected ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-adlive-warning">Conecta WhatsApp Cloud API en Integraciones para crear o sincronizar plantillas.</p> : null}
      {syncError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-adlive-danger">{syncError}</p> : null}
      <TemplatesTable templates={templates} onDelete={deleteWhatsappTemplate} />
      <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
