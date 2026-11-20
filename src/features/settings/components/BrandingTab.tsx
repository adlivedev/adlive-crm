"use client";

/* eslint-disable @next/next/no-img-element */

import { Image as ImageIcon, RotateCcw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { NEUTRAL_BRANDING, resolveTenantBranding } from "@/shared/lib/branding";
import { useCrm } from "@/shared/services/crmStore";
import type { TenantBranding } from "@/shared/types/database";

type ColorKey = "primary_color" | "primary_hover" | "accent_color" | "sidebar_bg" | "canvas_bg" | "ink_color";
type LogoVariant = "logo_url" | "logo_dark_url";

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: "primary_color", label: "Color primario" },
  { key: "primary_hover", label: "Primario hover" },
  { key: "accent_color", label: "Color de acento" },
  { key: "sidebar_bg", label: "Fondo del menú" },
  { key: "canvas_bg", label: "Fondo general" },
  { key: "ink_color", label: "Texto principal" },
];

interface LogoFieldProps {
  label: string;
  buttonLabel: string;
  value: string | null;
  loading: boolean;
  disabled: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}

function LogoField({ label, buttonLabel, value, loading, disabled, onUpload, onRemove }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    await onUpload(file);
    setPreview(null);
  };

  const image = preview ?? value;
  return (
    <div className="rounded-xl border border-adlive-border p-4">
      <p className="text-sm font-semibold text-adlive-text-main">{label}</p>
      <div className="mt-3 flex h-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-adlive-border bg-adlive-canvas-bg p-3">
        {image ? <img src={image} alt={`Vista previa: ${label}`} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-8 w-8 text-adlive-text-muted" aria-hidden />}
      </div>
      <input ref={inputRef} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={selectFile} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" isLoading={loading} disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden />{buttonLabel}
        </Button>
        {value ? <Button type="button" variant="ghost" size="sm" disabled={disabled || loading} onClick={onRemove}><X className="h-4 w-4" aria-hidden />Quitar</Button> : null}
      </div>
      <p className="mt-2 text-xs text-adlive-text-muted">PNG, JPEG o WebP. Máximo 2 MB.</p>
    </div>
  );
}

export function BrandingTab() {
  const router = useRouter();
  const { activeTenant, activeMember, updateActiveTenantBranding } = useCrm();
  const [branding, setBranding] = useState<TenantBranding>(() => resolveTenantBranding(activeTenant));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<LogoVariant | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setBranding(resolveTenantBranding(activeTenant)), [activeTenant]);

  if (!activeTenant || !activeMember || !["owner", "admin"].includes(activeMember.role)) return null;

  const applyBranding = (next: TenantBranding) => {
    setBranding(next);
    updateActiveTenantBranding(next);
  };

  const uploadLogo = async (variant: LogoVariant, file: File) => {
    setError("");
    setMessage("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Solo se permiten imágenes PNG, JPEG o WebP.");
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setError("La imagen no puede superar 2 MB.");
      return;
    }
    setUploading(variant);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("tenantId", activeTenant.id);
      body.append("variant", variant);
      const response = await fetch("/api/v1/tenants/branding/upload", { method: "POST", body });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "No se pudo subir el logo.");
      applyBranding({ ...branding, [variant]: result.url });
      setMessage("Logo subido y guardado en Supabase Storage.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el logo.");
    } finally {
      setUploading(null);
    }
  };

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
      updateActiveTenantBranding(branding);
      setMessage("Marca actualizada y aplicada al workspace.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la marca.");
    } finally {
      setSaving(false);
    }
  };

  const resetColors = () => {
    applyBranding({
      ...branding,
      primary_color: NEUTRAL_BRANDING.primary_color,
      primary_hover: NEUTRAL_BRANDING.primary_hover,
      accent_color: NEUTRAL_BRANDING.accent_color,
      sidebar_bg: NEUTRAL_BRANDING.sidebar_bg,
      canvas_bg: NEUTRAL_BRANDING.canvas_bg,
      ink_color: NEUTRAL_BRANDING.ink_color,
    });
    setMessage("Colores del sistema restablecidos en la vista. Guarda para hacerlos persistentes.");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-adlive-text-main">Marca y Apariencia</h2>
        <p className="mt-1 text-sm text-adlive-text-muted">Personaliza el workspace sin afectar a otras empresas.</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <Input label="Nombre visible" value={branding.brand_name} onChange={(event) => applyBranding({ ...branding, brand_name: event.target.value })} required minLength={2} maxLength={80} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LogoField label="Logo principal" buttonLabel="Subir Logo Principal" value={branding.logo_url} loading={uploading === "logo_url"} disabled={saving || uploading !== null} onUpload={(file) => uploadLogo("logo_url", file)} onRemove={() => applyBranding({ ...branding, logo_url: null })} />
            <LogoField label="Logo / Isotipo para fondo oscuro" buttonLabel="Subir Logo / Isotipo (Fondo Oscuro)" value={branding.logo_dark_url} loading={uploading === "logo_dark_url"} disabled={saving || uploading !== null} onUpload={(file) => uploadLogo("logo_dark_url", file)} onRemove={() => applyBranding({ ...branding, logo_dark_url: null })} />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-adlive-text-main">Paleta</legend>
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={resetColors}><RotateCcw className="h-4 w-4" aria-hidden />Restablecer colores por defecto</Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-adlive-border p-3 text-sm">
                  <input type="color" aria-label={label} value={branding[key]} onChange={(event) => applyBranding({ ...branding, [key]: event.target.value.toUpperCase() })} className="h-10 w-10 cursor-pointer rounded border-0 bg-transparent" />
                  <span><span className="block font-medium">{label}</span><span className="font-mono text-xs text-adlive-text-muted">{branding[key]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          <Button type="submit" isLoading={saving} disabled={uploading !== null} className="w-full sm:w-auto sm:self-start">Guardar apariencia</Button>
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
