"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import type { CaptureAttribution, CaptureField, CaptureTheme } from "@/shared/lib/leadCapture";
import { readableTextOn } from "@/shared/lib/leadCapture";

import { captureAttribution } from "../lib/attribution";

interface PublicLeadFormProps {
  tenantId: string;
  token: string;
  fields: CaptureField[];
  ctaText: string;
  primary: string;
  theme?: CaptureTheme;
  source?: string;
}

export function PublicLeadForm({ tenantId, token, fields, ctaText, primary, theme = "light", source }: PublicLeadFormProps) {
  const [attribution, setAttribution] = useState<CaptureAttribution>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState("");
  const dark = theme === "dark";
  const inputClass = `min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base outline-none transition focus:ring-2 disabled:opacity-60 ${dark ? "border-white/20 bg-white/10 text-white placeholder:text-slate-300" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"}`;
  const labelClass = `mb-1.5 block text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`;
  const style = { "--capture-primary": primary } as CSSProperties;

  useEffect(() => {
    setAttribution(captureAttribution(new URLSearchParams(window.location.search)));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    const form = new FormData(event.currentTarget);
    const customFields: Record<string, string> = {};
    for (const field of fields) {
      const value = String(form.get(`custom_${field.field_key}`) ?? "").trim();
      if (value) customFields[field.field_key] = value;
    }
    try {
      const response = await fetch(`/api/v1/${tenantId}/webhooks/lead-web`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          first_name: String(form.get("first_name") ?? ""),
          last_name: String(form.get("last_name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? "") || null,
          custom_fields: customFields,
          lead_source: source ?? attribution.utm_source ?? "Formulario Web",
          ...attribution,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el formulario.");
      setStatus("success");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar. Inténtalo de nuevo.");
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <div className={`flex min-h-72 flex-col items-center justify-center rounded-2xl p-8 text-center ${dark ? "text-white" : "text-slate-900"}`} role="status">
        <CheckCircle2 className="h-12 w-12" style={{ color: primary }} aria-hidden />
        <h2 className="mt-4 text-2xl font-bold">¡Recibimos tus datos!</h2>
        <p className={`mt-2 text-base ${dark ? "text-slate-200" : "text-slate-600"}`}>Un asesor del equipo se pondrá en contacto contigo.</p>
        <button type="button" onClick={() => setStatus("idle")} className="mt-6 min-h-11 cursor-pointer rounded-xl px-5 text-sm font-semibold underline underline-offset-4">Enviar otro lead</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={style} className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy={status === "submitting"}>
      <div>
        <label className={labelClass} htmlFor={`first-name-${tenantId}`}>Nombre *</label>
        <input className={inputClass} id={`first-name-${tenantId}`} name="first_name" autoComplete="given-name" maxLength={100} required disabled={status === "submitting"} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`last-name-${tenantId}`}>Apellido *</label>
        <input className={inputClass} id={`last-name-${tenantId}`} name="last_name" autoComplete="family-name" maxLength={100} required disabled={status === "submitting"} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`phone-${tenantId}`}>Teléfono *</label>
        <input className={inputClass} id={`phone-${tenantId}`} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+57 300 000 0000" maxLength={30} required disabled={status === "submitting"} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`email-${tenantId}`}>Correo electrónico</label>
        <input className={inputClass} id={`email-${tenantId}`} name="email" type="email" autoComplete="email" maxLength={255} disabled={status === "submitting"} />
      </div>
      {fields.map((field) => (
        <div key={field.id} className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${field.field_key}-${tenantId}`}>{field.field_label}</label>
          {field.field_type === "select" ? (
            <select className={inputClass} id={`${field.field_key}-${tenantId}`} name={`custom_${field.field_key}`} defaultValue="" disabled={status === "submitting"}>
              <option value="">Selecciona una opción</option>
              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input className={inputClass} id={`${field.field_key}-${tenantId}`} name={`custom_${field.field_key}`} type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"} maxLength={2000} disabled={status === "submitting"} />
          )}
        </div>
      ))}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "submitting"} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0" style={{ backgroundColor: primary, color: readableTextOn(primary) }}>
          {status === "submitting" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
          {status === "submitting" ? "Enviando…" : ctaText}
        </button>
        <p className={`mt-3 text-center text-xs leading-5 ${dark ? "text-slate-300" : "text-slate-600"}`}>Al enviar, aceptas que el equipo te contacte sobre esta solicitud.</p>
      </div>
    </form>
  );
}
