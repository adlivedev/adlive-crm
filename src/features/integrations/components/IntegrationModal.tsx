"use client";

import { Check, Copy, RefreshCw, Webhook } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { IntegrationProvider, TenantIntegrationVault } from "@/shared/types/database";
import type { IntegrationSpec } from "./integrationsData";

export interface IntegrationModalProps {
  open: boolean;
  spec: IntegrationSpec | null;
  integration: TenantIntegrationVault | undefined;
  webhookUrl: string;
  canManage: boolean;
  onClose: () => void;
  onSave: (provider: IntegrationProvider, values: Record<string, string>) => Promise<void>;
  onTest: (provider: IntegrationProvider) => Promise<string>;
  onRegenerate: (provider: IntegrationProvider) => Promise<string>;
}

export function IntegrationModal({ open, spec, integration, webhookUrl, canManage, onClose, onSave, onTest, onRegenerate }: IntegrationModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [currentToken, setCurrentToken] = useState("");
  const [busyAction, setBusyAction] = useState<"save" | "test" | "regenerate" | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!open || !spec) return;
    const initial = Object.fromEntries(spec.fields.filter((field) => !field.secret)
      .map((field) => [field.key, integration?.public_metadata[field.key] ?? ""]));
    setValues(initial);
    setCurrentToken(integration?.verify_token ?? "");
    setError(null);
    setAnnouncement("");
  }, [open, spec, integration]);

  if (!spec) return null;
  const connected = integration?.is_connected ?? false;
  const isMeta = ["whatsapp_cloud_api", "facebook_lead_ads", "instagram"].includes(spec.provider);
  const isComplete = spec.fields.every((field) => field.required === false || (connected && field.secret) || Boolean(values[field.key]?.trim()));

  const handleClose = () => {
    if (busyAction) return;
    setValues({}); setError(null); setAnnouncement(""); onClose();
  };
  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label); setAnnouncement(`${label} copiado.`);
      window.setTimeout(() => setCopied(""), 1800);
    } catch { setError("El navegador no permitió copiar. Selecciona el valor manualmente."); }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete || busyAction || !canManage) return;
    setBusyAction("save"); setError(null);
    try {
      await onSave(spec.provider, values);
      setValues({}); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la integración."); }
    finally { setBusyAction(null); }
  };
  const handleTest = async () => {
    setBusyAction("test"); setError(null); setAnnouncement("");
    try { setAnnouncement(await onTest(spec.provider)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo probar la conexión."); }
    finally { setBusyAction(null); }
  };
  const handleRegenerate = async () => {
    setBusyAction("regenerate"); setError(null); setAnnouncement("");
    try {
      const token = await onRegenerate(spec.provider);
      setCurrentToken(token); setValues((previous) => ({ ...previous, verify_token: token }));
      setAnnouncement("Verify Token regenerado. Actualízalo también en el proveedor.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo regenerar el token."); }
    finally { setBusyAction(null); }
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Configurar ${spec.name}`} subtitle="Configuración cifrada e independiente para este workspace.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-xl border border-adlive-cyan/30 bg-adlive-cyan-light p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-adlive-text-main"><Webhook className="h-4 w-4 text-cyan-700" aria-hidden />URL de Webhook Individual</div>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-adlive-text-main">{webhookUrl || "Cargando URL…"}</code>
            <Button size="sm" variant="secondary" aria-label="Copiar URL de webhook" onClick={() => void copy(webhookUrl, "URL de webhook")} disabled={!webhookUrl}>
              {copied === "URL de webhook" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {isMeta ? (
            <div className="mt-3 border-t border-adlive-cyan/20 pt-3">
              <p className="text-xs font-semibold text-adlive-text-main">Verify Token Individual</p>
              <div className="mt-2 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-adlive-text-main">{currentToken || (connected ? "Disponible para owner/admin después de recargar." : "Se generará al guardar si lo dejas vacío.")}</code>
                <Button size="sm" variant="secondary" aria-label="Copiar Verify Token" onClick={() => void copy(currentToken, "Verify Token")} disabled={!currentToken}><Copy className="h-4 w-4" /></Button>
              </div>
              {canManage && connected ? <Button size="sm" variant="ghost" className="mt-2 px-0" onClick={() => void handleRegenerate()} isLoading={busyAction === "regenerate"}><RefreshCw className="h-3.5 w-3.5" />Regenerar token</Button> : null}
            </div>
          ) : null}
        </div>

        {!canManage ? <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Solo un owner o admin del workspace puede modificar o probar esta integración.</p> : null}
        {spec.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Input label={field.label} value={values[field.key] ?? ""} onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))}
              placeholder={field.placeholder} type={field.secret ? "password" : "text"} autoComplete="off" disabled={!canManage}
              hint={connected && field.secret ? `${field.hint ? `${field.hint} ` : ""}Déjalo vacío para conservar el valor guardado.` : field.hint} />
          </div>
        ))}
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
        {announcement ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{announcement}</p> : null}
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          {canManage && connected ? <Button type="button" variant="secondary" onClick={() => void handleTest()} isLoading={busyAction === "test"} disabled={Boolean(busyAction)}>Probar conexión</Button> : null}
          <Button type="button" variant="secondary" onClick={handleClose} disabled={Boolean(busyAction)}>Cancelar</Button>
          <Button type="submit" disabled={!isComplete || Boolean(busyAction) || !canManage} isLoading={busyAction === "save"}>Guardar y conectar</Button>
        </div>
      </form>
    </Modal>
  );
}
