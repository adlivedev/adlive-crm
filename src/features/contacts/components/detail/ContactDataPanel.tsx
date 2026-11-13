"use client";

/**
 * M3 — Acordeón `Datos del contacto`: edición completa (nombre, teléfono,
 * email, empresa, fuente del lead y etiquetas separadas por coma) con
 * `Guardar cambios` funcional vía updateContact del store.
 */

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { formatDate } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

import { Accordion } from "./Accordion";

const SOURCE_OPTIONS = ["WhatsApp", "Meta Ads", "Google", "TikTok Ads", "Formulario Web", "Referido"];

const SELECT_CLASS =
  "h-11 w-full cursor-pointer rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

export function ContactDataPanel({ contact }: { contact: Contact }) {
  const { updateContact } = useCrm();
  const [fullName, setFullName] = useState(contact.full_name);
  const [phone, setPhone] = useState(contact.phone_e164);
  const [email, setEmail] = useState(contact.email ?? "");
  const [company, setCompany] = useState(contact.company_name ?? "");
  const [source, setSource] = useState(contact.lead_source);
  const [tags, setTags] = useState(contact.tags.join(", "));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reiniciar el formulario cuando se navega a otra ficha. */
  useEffect(() => {
    setFullName(contact.full_name);
    setPhone(contact.phone_e164);
    setEmail(contact.email ?? "");
    setCompany(contact.company_name ?? "");
    setSource(contact.lead_source);
    setTags(contact.tags.join(", "));
    setSaved(false);
    setError(null);
  }, [contact]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setError("El nombre del contacto es obligatorio.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Ingresa un teléfono válido (mínimo 10 dígitos).");
      return;
    }
    updateContact(contact.id, {
      full_name: fullName.trim(),
      phone_e164: digits,
      email: email.trim() || null,
      company_name: company.trim() || null,
      lead_source: source,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setError(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Accordion title="Datos del contacto" subtitle="Información general editable" defaultOpen>
      <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
        <Input label="Nombre" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <Input label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" required />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Sin email registrado" />
        <Input label="Negocio / Empresa" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Sin empresa registrada" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ficha-fuente-lead" className="text-sm font-medium text-adlive-text-main">
            Fuente del lead
          </label>
          <select id="ficha-fuente-lead" value={source} onChange={(event) => setSource(event.target.value)} className={SELECT_CLASS}>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Etiquetas (separadas por coma)"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="06112026v4, plan-38k"
        />
        <p className="text-xs text-adlive-text-muted">Creado el {formatDate(contact.created_at)}</p>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-adlive-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Cambios guardados.
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="sm" className="w-full">
          Guardar cambios
        </Button>
      </form>
    </Accordion>
  );
}
