"use client";

import { Eye, EyeOff, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { resolveTenantBranding } from "@/shared/lib/branding";
import type { TenantLanding } from "@/shared/lib/leadCapture";
import { useCrm } from "@/shared/services/crmStore";

import { CaptureCopyButton } from "./CaptureCopyButton";
import { CaptureGuide } from "./CaptureGuide";
import { EmbedForms } from "./EmbedForms";
import { LandingManager } from "./LandingManager";
import { maskToken } from "./settingsUtils";

export function WebhookUtmTab() {
  const { activeTenant } = useCrm();
  const [token, setToken] = useState("");
  const [landings, setLandings] = useState<TenantLanding[]>([]);
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => { setAppOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (!activeTenant?.id) return;
    let active = true;
    setLoading(true);
    void fetch(`/api/v1/lead-capture?tenantId=${encodeURIComponent(activeTenant.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { token?: string; landings?: TenantLanding[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "No se pudo cargar la captación.");
        if (active) { setToken(result.token ?? ""); setLandings(result.landings ?? []); setError(""); }
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeTenant?.id]);

  const branding = resolveTenantBranding(activeTenant);
  const webhookUrl = `${appOrigin}/api/v1/${activeTenant?.id ?? ""}/webhooks/lead-web`;
  const sampleLanding = landings[0];
  const landingUrl = sampleLanding && activeTenant ? `${appOrigin}/l/${activeTenant.slug}/${sampleLanding.slug}` : "";
  const iframeCode = `<iframe src="${landingUrl}" title="Formulario de captación" style="width:100%;height:760px;border:0" loading="lazy"></iframe>`;
  const scriptCode = useMemo(() => activeTenant ? `<div data-crm-form="${activeTenant.slug}" data-theme="light" data-primary="${branding.primary_color}"></div>\n<script src="${appOrigin}/api/v1/embed/${activeTenant.slug}/form.js" async></script>` : "", [activeTenant, appOrigin, branding.primary_color]);

  async function regenerateToken() {
    if (!activeTenant) return;
    setRegenerating(true);
    setError("");
    try {
      const response = await fetch("/api/v1/lead-capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: activeTenant.id, action: "regenerate-token" }) });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "No se pudo regenerar.");
      setToken(result.token);
      setShowToken(false);
      setConfirmRegenerate(false);
      setAnnouncement("Token regenerado. Actualiza los scripts y formularios externos que usaban el token anterior.");
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "No se pudo regenerar.");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-adlive-text-muted" role="status"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />Cargando landings y formularios…</div>;

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-adlive-text-main">Webhook individual de leads</h3><p className="mt-1 text-xs text-adlive-text-muted">Crea o actualiza el contacto y abre una oportunidad en Interesado dentro del pipeline principal.</p></div><Badge tone="success"><ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />Aislado por empresa</Badge></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Input readOnly label="URL del webhook" value={webhookUrl} onFocus={(event) => event.target.select()} /></div><CaptureCopyButton value={webhookUrl} label="Copiar URL" /></div></div>
          <div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input readOnly label="Token individual" value={showToken ? token : maskToken(token)} onFocus={(event) => event.target.select()} className="font-mono" aria-describedby="webhook-token-help" />
              </div>
              <Button type="button" variant="secondary" onClick={() => setShowToken((current) => !current)} aria-pressed={showToken} aria-label={showToken ? "Ocultar token" : "Mostrar token"}>
                {showToken ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}{showToken ? "Ocultar" : "Mostrar"}
              </Button>
              <CaptureCopyButton value={token} label="Copiar token" />
            </div>
            <p id="webhook-token-help" className="mt-1 text-xs text-adlive-text-muted">El token se muestra enmascarado por defecto; «Copiar» siempre copia el valor completo de forma segura.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmRegenerate ? <><Button type="button" variant="danger" onClick={() => void regenerateToken()} disabled={regenerating}>{regenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}{regenerating ? "Regenerando…" : "Confirmar regeneración"}</Button><Button type="button" variant="ghost" onClick={() => setConfirmRegenerate(false)}>Cancelar</Button><span className="text-xs text-adlive-danger">El token anterior dejará de funcionar.</span></> : <Button type="button" variant="ghost" onClick={() => setConfirmRegenerate(true)}><RefreshCw className="h-4 w-4" aria-hidden />Regenerar token</Button>}
        </div>
      </Card>

      {activeTenant ? <LandingManager tenantId={activeTenant.id} workspaceSlug={activeTenant.slug} appOrigin={appOrigin} landings={landings} onSaved={(saved) => setLandings((current) => current.map((landing) => landing.id === saved.id ? saved : landing))} /> : null}
      {activeTenant ? <EmbedForms workspaceSlug={activeTenant.slug} appOrigin={appOrigin} defaultPrimary={branding.primary_color} /> : null}
      <CaptureGuide webhookUrl={webhookUrl} token={token} iframeCode={iframeCode} scriptCode={scriptCode} />
    </div>
  );
}
