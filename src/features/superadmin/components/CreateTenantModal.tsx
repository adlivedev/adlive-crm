"use client";

import { useEffect, useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { TenantBranding } from "@/shared/types/database";

const INITIAL_BRANDING: TenantBranding = {
  brand_name: "",
  logo_url: null,
  logo_dark_url: null,
  primary_color: "#4F46E5",
  primary_hover: "#4338CA",
  accent_color: "#0891B2",
  sidebar_bg: "#111827",
  canvas_bg: "#F3F4F6",
  ink_color: "#111827",
};

const COLORS: Array<{ key: keyof Pick<TenantBranding, "primary_color" | "primary_hover" | "accent_color" | "sidebar_bg" | "canvas_bg" | "ink_color">; label: string }> = [
  { key: "primary_color", label: "Color primario" },
  { key: "primary_hover", label: "Primario hover" },
  { key: "accent_color", label: "Acento" },
  { key: "sidebar_bg", label: "Fondo del menú" },
  { key: "canvas_bg", label: "Fondo general" },
  { key: "ink_color", label: "Texto principal" },
];

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
}

interface CreateTenantModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTenantModal({ open, onClose, onCreated }: CreateTenantModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [branding, setBranding] = useState<TenantBranding>(INITIAL_BRANDING);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const updateName = (value: string) => {
    setName(value);
    setBranding((current) => ({ ...current, brand_name: value }));
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          adminEmail,
          temporaryPassword: temporaryPassword || undefined,
          branding,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear el workspace.");
      onCreated();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear el workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="create-tenant-title">
      <button type="button" aria-label="Cerrar modal" onClick={onClose} className="absolute inset-0 cursor-default" />
      <form onSubmit={handleSubmit} className="relative my-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="create-tenant-title" className="text-xl font-bold text-gray-950">Crear nueva empresa</h2>
            <p className="mt-1 text-sm text-gray-600">Aprovisiona acceso, marca y pipeline inicial.</p>
          </div>
          <BrandLogo tenant={{ name: branding.brand_name || "Nueva empresa", branding }} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nombre de la empresa" value={name} onChange={(event) => updateName(event.target.value)} required minLength={2} />
          <Input label="Slug del workspace" value={slug} onChange={(event) => { setSlug(slugify(event.target.value)); setSlugEdited(true); }} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
          <Input label="Correo del administrador" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required autoComplete="off" />
          <Input label="Contraseña temporal (opcional)" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={12} autoComplete="new-password" />
        </div>
        <p className="mt-2 text-xs text-gray-500">Sin contraseña temporal se enviará una invitación por correo.</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="URL del logo (HTTPS o ruta local)" value={branding.logo_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_url: event.target.value || null })} placeholder="https://…" />
          <Input label="URL del logo para fondo oscuro" value={branding.logo_dark_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_dark_url: event.target.value || null })} placeholder="https://…" />
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-gray-900">Paleta de marca</legend>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
                <input
                  type="color"
                  value={branding[key]}
                  onChange={(event) => setBranding({ ...branding, [key]: event.target.value.toUpperCase() })}
                  className="h-10 w-10 cursor-pointer rounded border-0 bg-transparent"
                  aria-label={label}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{label}</span>
                  <span className="font-mono text-xs text-gray-500">{branding[key]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" isLoading={submitting}>Crear workspace</Button>
        </div>
      </form>
    </div>
  );
}
