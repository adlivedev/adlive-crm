"use client";

import { MailCheck, Save, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";

interface SmtpSettingsResponse {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
  updated_at: string;
  has_password: boolean;
}

interface SmtpForm {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
}

const EMPTY_FORM: SmtpForm = {
  host: "", port: 587, secure: false, username: "", from_name: "ADlive", from_email: "", is_active: true,
};

export function SmtpSettingsTab() {
  const { session } = useCrm();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<SmtpForm>(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [testEmail, setTestEmail] = useState(session?.email ?? "");
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/v1/superadmin/smtp", { cache: "no-store" });
        const result = await response.json() as { settings?: SmtpSettingsResponse | null; error?: string };
        if (!response.ok) throw new Error(result.error ?? "No se pudo cargar SMTP.");
        if (!active) return;
        if (result.settings) {
          setForm({
            host: result.settings.host,
            port: result.settings.port,
            secure: result.settings.secure,
            username: result.settings.username,
            from_name: result.settings.from_name,
            from_email: result.settings.from_email,
            is_active: result.settings.is_active,
          });
          setHasPassword(result.settings.has_password);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar SMTP.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const submit = async (action: "save" | "testEmail") => {
    if (action === "save") setSaving(true);
    else setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/superadmin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          action,
          password: password || undefined,
          test_email: action === "testEmail" ? testEmail : undefined,
        }),
      });
      const result = await response.json() as { settings?: SmtpSettingsResponse; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la configuración SMTP.");
      setHasPassword(result.settings?.has_password ?? true);
      setPassword("");
      setMessage(result.message ?? "Configuración SMTP guardada.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo procesar SMTP.");
    } finally {
      setSaving(false);
      setTesting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit("save");
  };

  return (
    <Card className="max-w-4xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-adlive-primary-light p-2.5 text-adlive-primary"><MailCheck className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 className="text-lg font-bold text-adlive-text-main">SMTP Global</h2>
          <p className="mt-1 text-sm text-adlive-text-muted">Remitente exclusivo de plataforma para invitaciones y correos marca blanca.</p>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-adlive-canvas-bg px-4 py-3 text-xs text-adlive-text-muted">La contraseña se cifra con AES-256-GCM en el servidor. Nunca se devuelve al navegador.</p>
      {loading ? <p role="status" className="mt-6 text-sm text-adlive-text-muted">Cargando configuración…</p> : (
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Input label="Host" value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="smtp.proveedor.com" required maxLength={255} autoComplete="off" />
            <Input label="Puerto" type="number" min={1} max={65535} value={form.port} onChange={(event) => setForm({ ...form, port: Number(event.target.value) })} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Usuario" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required maxLength={255} autoComplete="off" />
            <Input label="Contraseña" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={!hasPassword} maxLength={512} autoComplete="new-password" hint={hasPassword ? "Hay una contraseña guardada. Déjala en blanco para conservarla." : "Se cifrará antes de guardarse."} />
            <Input label="Nombre remitente" value={form.from_name} onChange={(event) => setForm({ ...form, from_name: event.target.value })} required minLength={2} maxLength={150} />
            <Input label="Correo remitente" type="email" value={form.from_email} onChange={(event) => setForm({ ...form, from_email: event.target.value })} required maxLength={255} autoComplete="off" />
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.secure} onChange={(event) => setForm({ ...form, secure: event.target.checked })} className="h-4 w-4 accent-adlive-primary" />SSL/TLS directo</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4 accent-adlive-primary" />Configuración activa</label>
          </div>
          <div className="rounded-xl border border-adlive-border p-4">
            <Input label="Destinatario del correo de prueba" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} required maxLength={255} />
            <p className="mt-2 text-xs text-adlive-text-muted">La prueba guarda la configuración y realiza un envío real con la marca del workspace ADlive.</p>
          </div>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" isLoading={saving} disabled={testing}><Save className="h-4 w-4" aria-hidden />Guardar SMTP</Button>
            <Button type="button" variant="secondary" isLoading={testing} disabled={saving} onClick={() => { if (formRef.current?.reportValidity()) void submit("testEmail"); }}><Send className="h-4 w-4" aria-hidden />Enviar correo de prueba</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
