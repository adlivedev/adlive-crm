"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, Send } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

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
  /** Fase 2 — constructor de formularios: */
  columns?: 1 | 2 | 3;
  multistep?: boolean;
  htmlBlocks?: Array<{ id: string; content_html: string }>;
  inputBg?: string;
  buttonColor?: string;
  fontFamily?: string;
  heading?: string;
}

const FIELD_SPAN: Record<string, string> = { textarea: " sm:col-span-2", html: " sm:col-span-2" };

export function PublicLeadForm({ tenantId, token, fields, ctaText, primary, theme = "light", source, columns = 2, multistep = false, htmlBlocks = [], inputBg, buttonColor, fontFamily, heading }: PublicLeadFormProps) {
  const [attribution, setAttribution] = useState<CaptureAttribution>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const dark = theme === "dark";
  const inputClass = `min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base outline-none transition focus:ring-2 disabled:opacity-60 ${dark ? "border-white/20 text-white placeholder:text-slate-300" : "border-slate-300 text-slate-900 placeholder:text-slate-500"}`;
  const labelClass = `mb-1.5 block text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`;
  const style = { "--capture-primary": primary } as CSSProperties;
  const wrapperStyle = (fontFamily ? { fontFamily: `${fontFamily}, system-ui, sans-serif` } : undefined) as CSSProperties | undefined;
  const inputStyle = inputBg ? { backgroundColor: inputBg } : undefined;
  const buttonBg = buttonColor ?? primary;

  useEffect(() => {
    setAttribution(captureAttribution(new URLSearchParams(window.location.search)));
  }, []);

  // Multi-step simple: los pasos se calculan sobre los campos personalizados
  // (los 4 base siempre van en el paso 1) en grupos de 4.
  const steps = useMemo(() => {
    if (!multistep || fields.length <= 4) return null;
    const chunks: CaptureField[][] = [];
    for (let index = 0; index < fields.length; index += 4) chunks.push(fields.slice(index, index + 4));
    return chunks;
  }, [multistep, fields]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    const form = new FormData(event.currentTarget);
    const customFields: Record<string, string> = {};
    for (const field of fields) {
      if (field.field_type === "html") continue;
      const value = field.field_type === "checkbox"
        ? (form.get(`custom_${field.field_key}`) ? "Sí" : "")
        : String(form.get(`custom_${field.field_key}`) ?? "").trim();
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
      const result = await response.json() as {
        error?: string;
        /* QA-NEW-011: el backend devuelve errores por campo (zod). */
        fields?: Record<string, string[] | undefined>;
      };
      if (!response.ok) {
        /* Mostrar el mensaje específico del primer campo fallido (p. ej. el
           error exacto del teléfono) en lugar del genérico «Payload no válido». */
        const firstFieldError = result.fields
          ? Object.values(result.fields).flat().find((message) => Boolean(message))
          : undefined;
        throw new Error(firstFieldError ?? result.error ?? "No se pudo enviar el formulario.");
      }
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

  const gridClass = columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
  const visibleFields = steps ? (step === 0 ? [] : steps[step - 1] ?? []) : fields;
  const totalSteps = steps ? steps.length + 1 : 1;

  function renderField(field: CaptureField) {
    const span = columns === 1 ? "" : (FIELD_SPAN[field.field_type] ?? "");
    if (field.field_type === "html") {
      return <div key={field.id} className={`${span || (columns === 1 ? "" : " sm:col-span-2")} rounded-xl text-sm leading-6 [&_a]:underline ${dark ? "text-slate-200" : "text-slate-700"}`} dangerouslySetInnerHTML={{ __html: field.options[0] ?? "" }} />;
    }
    return (
      <div key={field.id} className={span}>
        {field.field_type === "checkbox" ? (
          <label className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium ${dark ? "border-white/20 text-slate-100" : "border-slate-300 text-slate-800"}`} style={inputStyle}>
            <input type="checkbox" name={`custom_${field.field_key}`} className="h-4 w-4 accent-[#5B00FF]" disabled={status === "submitting"} />
            {field.field_label}
          </label>
        ) : (
          <>
            <label className={labelClass} htmlFor={`${field.field_key}-${tenantId}`}>{field.field_label}</label>
            {field.field_type === "textarea" ? (
              <textarea className={inputClass} style={inputStyle} id={`${field.field_key}-${tenantId}`} name={`custom_${field.field_key}`} rows={3} maxLength={2000} disabled={status === "submitting"} />
            ) : field.field_type === "radio" ? (
              <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label={field.field_label}>
                {field.options.map((option) => (
                  <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${dark ? "border-white/20 text-slate-100" : "border-slate-300 text-slate-800"}`} style={inputStyle}>
                    <input type="radio" name={`custom_${field.field_key}`} value={option} className="h-4 w-4 accent-[#5B00FF]" disabled={status === "submitting"} />
                    {option}
                  </label>
                ))}
              </div>
            ) : field.field_type === "select" ? (
              <select className={inputClass} style={inputStyle} id={`${field.field_key}-${tenantId}`} name={`custom_${field.field_key}`} defaultValue="" disabled={status === "submitting"}>
                <option value="">Selecciona una opción</option>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input
                className={inputClass}
                style={inputStyle}
                id={`${field.field_key}-${tenantId}`}
                name={`custom_${field.field_key}`}
                type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : "text"}
                inputMode={field.field_type === "phone" ? "tel" : field.field_type === "number" ? "numeric" : undefined}
                placeholder={field.field_type === "phone" ? "+57 300 000 0000" : undefined}
                maxLength={2000}
                disabled={status === "submitting"}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      {heading ? <h1 className={`mb-5 text-xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>{heading}</h1> : null}
      {htmlBlocks.map((block) => (
        <div key={block.id} className={`mb-4 rounded-xl text-sm leading-6 [&_a]:underline ${dark ? "text-slate-200" : "text-slate-700"}`} dangerouslySetInnerHTML={{ __html: block.content_html }} />
      ))}
      <form onSubmit={submit} style={style} className={`grid grid-cols-1 gap-4 ${gridClass}`} aria-busy={status === "submitting"}>
        {step === 0 ? (
          <>
            <div>
              <label className={labelClass} htmlFor={`first-name-${tenantId}`}>Nombre *</label>
              <input className={inputClass} style={inputStyle} id={`first-name-${tenantId}`} name="first_name" autoComplete="given-name" maxLength={100} required disabled={status === "submitting"} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`last-name-${tenantId}`}>Apellido *</label>
              <input className={inputClass} style={inputStyle} id={`last-name-${tenantId}`} name="last_name" autoComplete="family-name" maxLength={100} required disabled={status === "submitting"} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`phone-${tenantId}`}>Teléfono *</label>
              <input className={inputClass} style={inputStyle} id={`phone-${tenantId}`} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+57 300 000 0000" maxLength={30} required disabled={status === "submitting"} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`email-${tenantId}`}>Correo electrónico</label>
              <input className={inputClass} style={inputStyle} id={`email-${tenantId}`} name="email" type="email" autoComplete="email" maxLength={255} disabled={status === "submitting"} />
            </div>
          </>
        ) : null}
        {visibleFields.map(renderField)}
        {error ? <p role="alert" className={`rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ${columns === 1 ? "" : "sm:col-span-2"}`}>{error}</p> : null}
        <div className={columns === 1 ? "" : "sm:col-span-2"}>
          {steps ? (
            <div className="mb-3 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || status === "submitting"} className="flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" aria-hidden />Atrás
              </button>
              <span className="text-xs font-medium text-slate-500" aria-live="polite">Paso {step + 1} de {totalSteps}</span>
              {step < totalSteps - 1 ? (
                <button type="button" onClick={() => setStep((current) => Math.min(totalSteps - 1, current + 1))} disabled={status === "submitting"} className="flex min-h-11 cursor-pointer items-center gap-1 rounded-xl px-4 text-sm font-semibold text-white" style={{ backgroundColor: buttonBg }}>
                  Siguiente<ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
          {step === totalSteps - 1 ? (
            <button type="submit" disabled={status === "submitting"} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0" style={{ backgroundColor: buttonBg, color: readableTextOn(buttonBg) }}>
              {status === "submitting" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
              {status === "submitting" ? "Enviando…" : ctaText}
            </button>
          ) : null}
          <p className={`mt-3 text-center text-xs leading-5 ${dark ? "text-slate-300" : "text-slate-600"}`}>Al enviar, aceptas que el equipo te contacte sobre esta solicitud.</p>
        </div>
      </form>
    </div>
  );
}
