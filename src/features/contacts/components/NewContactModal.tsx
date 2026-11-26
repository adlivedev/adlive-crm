"use client";

/**
 * M3 — Modal `+ Nuevo contacto`: crea el contacto directamente en el store
 * reactivo (CRUD en memoria, Etapa A) con validación de campos obligatorios.
 */

import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { normalizeCoPhone } from "@/shared/lib/phone";
import { useCrm } from "@/shared/services/crmStore";

import { Modal } from "./Modal";

export interface NewContactModalProps {
  open: boolean;
  onClose: () => void;
}

const SOURCE_OPTIONS = ["WhatsApp", "Meta Ads", "Google", "TikTok Ads", "Formulario Web", "Referido"];

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

export function NewContactModal({ open, onClose }: NewContactModalProps) {
  const { createContact } = useCrm();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState(SOURCE_OPTIONS[0]!);
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setSource(SOURCE_OPTIONS[0]!);
    setTags("");
    setError(null);
    setSaved(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setError("El nombre del contacto es obligatorio.");
      return;
    }
    const normalized = normalizeCoPhone(phone);
    if (!normalized.ok) {
      setError(normalized.reason);
      return;
    }
    createContact({
      full_name: fullName,
      phone_e164: normalized.e164,
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
    window.setTimeout(() => handleClose(), 700);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo contacto" subtitle="Se creará en la base de datos de la cuenta activa.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Nombre completo" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ej: ARMANDO CARDENAS CAPERA" required />
        <Input label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="573207949885" inputMode="tel" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Email (opcional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" />
          <Input label="Negocio / Empresa (opcional)" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Ej: Ferretería Suárez" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nuevo-contacto-fuente" className="text-sm font-medium text-adlive-text-main">
              Fuente del lead
            </label>
            <select
              id="nuevo-contacto-fuente"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className={INPUT_CLASS}
            >
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
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-adlive-success">
            Contacto creado correctamente.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saved}>
            {saved ? "Guardado" : "Crear contacto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
