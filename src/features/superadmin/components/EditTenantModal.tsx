"use client";

/* eslint-disable @next/next/no-img-element */

import { RotateCcw, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { NEUTRAL_BRANDING, resolveTenantBranding } from "@/shared/lib/branding";
import type { TenantBranding } from "@/shared/types/database";

import type { PlatformTenantMetric } from "../types";

type LogoVariant = "logo_url" | "logo_dark_url";

const COLORS: Array<{ key: keyof Pick<TenantBranding, "primary_color" | "primary_hover" | "accent_color" | "sidebar_bg" | "canvas_bg" | "ink_color">; label: string }> = [
  { key: "primary_color", label: "Color primario" },
  { key: "primary_hover", label: "Primario hover" },
  { key: "accent_color", label: "Acento" },
  { key: "sidebar_bg", label: "Fondo del menú" },
  { key: "canvas_bg", label: "Fondo general" },
  { key: "ink_color", label: "Texto principal" },
];

interface EditTenantModalProps {
  tenant: PlatformTenantMetric | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTenantModal({ tenant, onClose, onSaved }: EditTenantModalProps) {
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [branding, setBranding] = useState<TenantBranding>(NEUTRAL_BRANDING);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [darkLogoFile, setDarkLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [darkLogoPreview, setDarkLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setAdminEmail(tenant.admin_email ?? "");
    setBranding(resolveTenantBranding({ name: tenant.name, branding: tenant.branding }));
    setLogoFile(null);
    setDarkLogoFile(null);
    setError("");
  }, [tenant]);

  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (!darkLogoFile) { setDarkLogoPreview(null); return; }
    const url = URL.createObjectURL(darkLogoFile);
    setDarkLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [darkLogoFile]);

  useEffect(() => {
    if (!tenant) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [tenant, onClose, saving]);

  if (!tenant) return null;

  const upload = async (variant: LogoVariant, file: File): Promise<string> => {
    const body = new FormData();
    body.append("tenantId", tenant.id);
    body.append("variant", variant);
    body.append("file", file);
    const response = await fetch("/api/v1/tenants/branding/upload", { method: "POST", body });
    const result = await response.json() as { url?: string; error?: string };
    if (!response.ok || !result.url) throw new Error(result.error ?? "No se pudo subir un logo.");
    return result.url;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const nextBranding = { ...branding };
      if (logoFile) nextBranding.logo_url = await upload("logo_url", logoFile);
      if (darkLogoFile) nextBranding.logo_dark_url = await upload("logo_dark_url", darkLogoFile);
      const response = await fetch("/api/v1/superadmin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, name, adminEmail, branding: nextBranding }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar el workspace.");
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el workspace.");
    } finally {
      setSaving(false);
    }
  };

  const resetColors = () => setBranding({
    ...branding,
    primary_color: NEUTRAL_BRANDING.primary_color,
    primary_hover: NEUTRAL_BRANDING.primary_hover,
    accent_color: NEUTRAL_BRANDING.accent_color,
    sidebar_bg: NEUTRAL_BRANDING.sidebar_bg,
    canvas_bg: NEUTRAL_BRANDING.canvas_bg,
    ink_color: NEUTRAL_BRANDING.ink_color,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edit-tenant-title">
      <button type="button" aria-label="Cerrar modal" onClick={onClose} className="absolute inset-0 cursor-default" />
      <form onSubmit={handleSubmit} className="relative my-auto w-full max-w-3xl rounded-2xl bg-white p-5 text-gray-950 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 id="edit-tenant-title" className="text-xl font-bold">Editar empresa / workspace</h2><p className="mt-1 font-mono text-xs text-gray-500">{tenant.slug}</p></div>
          <BrandLogo tenant={{ name, branding }} />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nombre de la empresa" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={150} />
          <Input label="Correo del propietario" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required maxLength={255} />
        </div>
        <Input className="mt-4" label="Nombre visible de la marca" value={branding.brand_name} onChange={(event) => setBranding({ ...branding, brand_name: event.target.value })} required minLength={2} maxLength={80} />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            { variant: "logo_url" as const, label: "Logo principal", file: logoFile, preview: logoPreview, value: branding.logo_url, setFile: setLogoFile },
            { variant: "logo_dark_url" as const, label: "Logo para fondo oscuro", file: darkLogoFile, preview: darkLogoPreview, value: branding.logo_dark_url, setFile: setDarkLogoFile },
          ]).map((item) => (
            <div key={item.variant} className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold">{item.label}</p>
              <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-gray-50 p-3">
                {(item.preview ?? item.value) ? <img src={item.preview ?? item.value ?? ""} alt={`Vista previa de ${item.label}`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-500">Sin logo</span>}
              </div>
              <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold hover:bg-gray-50">
                <Upload className="h-4 w-4" aria-hidden />{item.file ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={(event) => item.setFile(event.target.files?.[0] ?? null)} />
              </label>
              {item.value ? <Button type="button" variant="ghost" size="sm" className="ml-1" onClick={() => { item.setFile(null); setBranding({ ...branding, [item.variant]: null }); }}>Quitar</Button> : null}
              <p className="mt-2 truncate text-xs text-gray-500">{item.file?.name ?? "PNG, JPEG o WebP · máximo 2 MB"}</p>
            </div>
          ))}
        </div>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">Paleta de marca</legend>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={resetColors}><RotateCcw className="h-4 w-4" aria-hidden />Restablecer colores</Button>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
                <input type="color" value={branding[key]} onChange={(event) => setBranding({ ...branding, [key]: event.target.value.toUpperCase() })} className="h-10 w-10 cursor-pointer rounded border-0 bg-transparent" aria-label={label} />
                <span><span className="block font-medium">{label}</span><span className="font-mono text-xs text-gray-500">{branding[key]}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" isLoading={saving}>Guardar empresa</Button>
        </div>
      </form>
    </div>
  );
}
