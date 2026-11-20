"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import type { CaptureTheme } from "@/shared/lib/leadCapture";

import { CaptureCopyButton } from "./CaptureCopyButton";

const THEMES: Array<{ key: CaptureTheme; label: string }> = [
  { key: "light", label: "Blanco" },
  { key: "dark", label: "Negro" },
  { key: "transparent", label: "Transparente" },
];

export function EmbedForms({ workspaceSlug, appOrigin, defaultPrimary }: { workspaceSlug: string; appOrigin: string; defaultPrimary: string }) {
  const [theme, setTheme] = useState<CaptureTheme>("light");
  const [primary, setPrimary] = useState(defaultPrimary);
  const iframeUrl = `${appOrigin}/embed/${workspaceSlug}/form?theme=${theme}&primary=${encodeURIComponent(primary)}`;
  const script = useMemo(() => `<div data-crm-form="${workspaceSlug}" data-theme="${theme}" data-primary="${primary}"></div>\n<script src="${appOrigin}/api/v1/embed/${workspaceSlug}/form.js" async></script>`, [appOrigin, primary, theme, workspaceSlug]);
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-adlive-border px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-adlive-text-main">Formularios embebibles tipo HubSpot</h3><p className="mt-1 text-xs text-adlive-text-muted">Dos líneas para WordPress, Webflow, Shopify o HTML. La atribución se conserva durante 90 días.</p></div>
          <Badge tone="success">Listos para pegar</Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Tema del formulario">
          {THEMES.map((item) => <button key={item.key} type="button" aria-pressed={theme === item.key} onClick={() => setTheme(item.key)} className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-semibold transition ${theme === item.key ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:text-adlive-text-main"}`}>{item.label}</button>)}
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-adlive-border bg-white px-3 text-xs font-medium text-adlive-text-muted">Color principal<input type="color" value={primary} onChange={(event) => setPrimary(event.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" aria-label="Color principal del formulario" /></label>
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-adlive-border p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Script de instalación</h4><CaptureCopyButton value={script} label="Copiar script" copiedLabel="Script copiado" /></div>
          <pre className="overflow-x-auto rounded-xl bg-adlive-sidebar-bg p-4 text-xs leading-6 text-emerald-200"><code>{script}</code></pre>
        </div>
        <div className="bg-adlive-canvas-bg p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Vista previa en vivo</h4>
          <iframe key={iframeUrl} src={iframeUrl} title={`Vista previa del formulario ${theme}`} className="h-[520px] w-full rounded-xl border border-adlive-border bg-white" />
        </div>
      </div>
    </Card>
  );
}
