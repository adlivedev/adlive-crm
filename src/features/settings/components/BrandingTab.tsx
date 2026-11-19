"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { resolveTenantBranding } from "@/shared/lib/branding";
import { useCrm } from "@/shared/services/crmStore";
import type { TenantBranding } from "@/shared/types/database";

type ColorKey = "primary_color" | "primary_hover" | "accent_color" | "sidebar_bg" | "canvas_bg" | "ink_color";

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: "primary_color", label: "Color primario" },
  { key: "primary_hover", label: "Primario hover" },
  { key: "accent_color", label: "Color de acento" },
  { key: "sidebar_bg", label: "Fondo del menú" },
  { key: "canvas_bg", label: "Fondo general" },
  { key: "ink_color", label: "Texto principal" },
];

export function BrandingTab() {
  const router = useRouter();
  const { activeTenant, activeMember } = useCrm();
  const [branding, setBranding] = useState<TenantBranding>(() => resolveTenantBranding(activeTenant));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setBranding(resolveTenantBranding(activeTenant)), [activeTenant]);

  if (!activeTenant || !activeMember || !["owner", "admin"].includes(activeMember.role)) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/tenants/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenant.id, branding }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la marca.");
      setMessage("Marca actualizada. La vista se refrescará con la configuración persistente.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la marca.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-adlive-text-main">Marca y Apariencia</h2>
        <p className="mt-1 text-sm text-adlive-text-muted">Personaliza el workspace sin afectar a otras empresas.</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <Input label="Nombre visible" value={branding.brand_name} onChange={(event) => setBranding({ ...branding, brand_name: event.target.value })} required minLength={2} maxLength={80} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="URL del logo" value={branding.logo_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_url: event.target.value || null })} placeholder="/brands/empresa/logo.png" />
            <Input label="Logo para fondo oscuro" value={branding.logo_dark_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_dark_url: event.target.value || null })} placeholder="https://…" />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-adlive-text-main">Paleta</legend>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-adlive-border p-3 text-sm">
                  <input type="color" aria-label={label} value={branding[key]} onChange={(event) => setBranding({ ...branding, [key]: event.target.value.toUpperCase() })} className="h-10 w-10 cursor-pointer rounded border-0 bg-transparent" />
                  <span><span className="block font-medium">{label}</span><span className="font-mono text-xs text-adlive-text-muted">{branding[key]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          <Button type="submit" isLoading={saving} className="w-full sm:w-auto sm:self-start">Guardar apariencia</Button>
        </form>
      </Card>
      <TenantThemeProvider tenant={{ name: branding.brand_name, branding }} className="h-fit rounded-2xl bg-adlive-canvas-bg p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Vista previa</p>
        <div className="rounded-xl bg-adlive-sidebar-bg p-4"><BrandLogo tenant={{ name: branding.brand_name, branding }} tone="light" /></div>
        <div className="mt-3 rounded-xl border border-adlive-border bg-white p-4"><BrandLogo tenant={{ name: branding.brand_name, branding }} /><Button size="sm" className="mt-4">Botón de ejemplo</Button></div>
      </TenantThemeProvider>
    </div>
  );
}
