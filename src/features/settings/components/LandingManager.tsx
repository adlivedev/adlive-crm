"use client";

import { ExternalLink, LoaderCircle, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import type { TenantLanding } from "@/shared/lib/leadCapture";
import { useCrm } from "@/shared/services/crmStore";

import { CaptureCopyButton } from "./CaptureCopyButton";

const TEMPLATE_LABELS: Record<string, string> = { hero_split: "Split Hero Conversión", minimal_lead: "Minimal Centrada", promo_offer: "Oferta Promocional" };

interface LandingManagerProps {
  tenantId: string;
  workspaceSlug: string;
  appOrigin: string;
  landings: TenantLanding[];
  onSaved: (landing: TenantLanding) => void;
}

export function LandingManager({ tenantId, workspaceSlug, appOrigin, landings, onSaved }: LandingManagerProps) {
  const { activeTenant } = useCrm();
  const [selectedSlug, setSelectedSlug] = useState(landings[0]?.slug ?? "");
  const selected = useMemo(() => landings.find((landing) => landing.slug === selectedSlug) ?? landings[0] ?? null, [landings, selectedSlug]);
  const [draft, setDraft] = useState<TenantLanding | null>(selected);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewVersion, setPreviewVersion] = useState(0);
  useEffect(() => { setDraft(selected); setMessage(""); }, [selected]);
  if (!draft) return <Card className="p-6 text-sm text-adlive-text-muted">No se encontraron las tres landings predeterminadas.</Card>;

  const publicUrl = `${appOrigin}/l/${workspaceSlug}/${draft.slug}`;
  const iframeCode = `<iframe src="${publicUrl}" title="${draft.name}" style="width:100%;height:760px;border:0;border-radius:16px" loading="lazy"></iframe>`;
  const brandPrimary = activeTenant?.branding?.primary_color ?? "#5B00FF";
  const brandBackground = activeTenant?.branding?.canvas_bg ?? "#F6F7FB";
  const brandText = activeTenant?.branding?.ink_color ?? "#18181B";

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/lead-capture", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId, landingId: draft.id, name: draft.name, title: draft.title, subtitle: draft.subtitle,
          cta_text: draft.cta_text, color_mode: draft.color_mode, custom_primary_color: draft.custom_primary_color,
          custom_bg_color: draft.custom_bg_color, custom_text_color: draft.custom_text_color, is_active: draft.is_active,
        }),
      });
      const result = await response.json() as { landing?: TenantLanding; error?: string };
      if (!response.ok || !result.landing) throw new Error(result.error ?? "No se pudo guardar.");
      onSaved(result.landing);
      setDraft(result.landing);
      setPreviewVersion((value) => value + 1);
      setMessage("Cambios guardados y vista previa actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof TenantLanding>(key: K, value: TenantLanding[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-adlive-border px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-adlive-text-main">Tres landings listas para captar</h3><p className="mt-1 text-xs text-adlive-text-muted">Heredan la marca del workspace o usan colores individuales.</p></div><Badge tone="success">{landings.length} activas</Badge></div>
        <div className="mt-5 grid gap-2 md:grid-cols-3" role="tablist" aria-label="Plantillas de landing">
          {landings.map((landing) => <button key={landing.id} type="button" role="tab" aria-selected={draft.slug === landing.slug} onClick={() => setSelectedSlug(landing.slug)} className={`min-h-12 cursor-pointer rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${draft.slug === landing.slug ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:text-adlive-text-main"}`}>{TEMPLATE_LABELS[landing.template_key] ?? landing.name}</button>)}
        </div>
      </div>
      <div className="grid xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 border-b border-adlive-border p-6 xl:border-b-0 xl:border-r">
          <Input label="Nombre interno" value={draft.name} onChange={(event) => patch("name", event.target.value)} maxLength={150} />
          <Input label="Título" value={draft.title} onChange={(event) => patch("title", event.target.value)} maxLength={200} />
          <label className="block text-sm font-medium text-adlive-text-main">Subtítulo<textarea value={draft.subtitle ?? ""} onChange={(event) => patch("subtitle", event.target.value)} maxLength={2000} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm outline-none focus:border-adlive-primary focus:ring-2 focus:ring-adlive-primary/20" /></label>
          <Input label="Texto del botón (CTA)" value={draft.cta_text} onChange={(event) => patch("cta_text", event.target.value)} maxLength={80} />
          <label className="block text-sm font-medium text-adlive-text-main">Colores<select value={draft.color_mode} onChange={(event) => patch("color_mode", event.target.value as TenantLanding["color_mode"])} className="mt-1.5 h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm outline-none focus:border-adlive-primary focus:ring-2 focus:ring-adlive-primary/20"><option value="workspace">Heredar del workspace</option><option value="custom">Personalizados para esta landing</option></select></label>
          {draft.color_mode === "custom" ? <div className="grid grid-cols-3 gap-3">{([
            ["custom_primary_color", "Principal", brandPrimary], ["custom_bg_color", "Fondo", brandBackground], ["custom_text_color", "Texto", brandText],
          ] as const).map(([key, label, fallback]) => <label key={key} className="text-center text-xs font-medium text-adlive-text-muted"><input type="color" aria-label={`Color ${label.toLowerCase()}`} value={draft[key] ?? fallback} onChange={(event) => patch(key, event.target.value.toUpperCase())} className="mb-1 block h-10 w-full cursor-pointer rounded-lg border border-adlive-border bg-white p-1" />{label}</label>)}</div> : null}
          <div className="flex flex-wrap gap-2 pt-2"><Button type="button" onClick={() => void save()} disabled={saving || draft.title.trim().length < 2 || draft.cta_text.trim().length < 2}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{saving ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" variant="secondary" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" aria-hidden />Abrir landing</Button></div>
          <div className="flex flex-wrap gap-2"><CaptureCopyButton value={publicUrl} label="Copiar URL" /><CaptureCopyButton value={iframeCode} label="Copiar código iframe" copiedLabel="Iframe copiado" /></div>
          <p aria-live="polite" className="text-xs text-adlive-text-muted">{message}</p>
        </div>
        <div className="min-w-0 bg-adlive-canvas-bg p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Vista previa guardada</h4><span className="truncate font-mono text-xs text-adlive-text-muted">/l/{workspaceSlug}/{draft.slug}</span></div>
          <iframe key={`${draft.id}-${previewVersion}`} src={publicUrl} title={`Vista previa de ${draft.name}`} className="h-[680px] w-full rounded-2xl border border-adlive-border bg-white shadow-sm" />
        </div>
      </div>
    </Card>
  );
}
