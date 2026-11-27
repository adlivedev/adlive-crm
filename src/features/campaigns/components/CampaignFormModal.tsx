"use client";

/** Modal de creación/edición de campañas masivas. Guardar NUNCA envía. */

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { createClient } from "@/shared/lib/supabase/client";
import { useCrm } from "@/shared/services/crmStore";
import type { Campaign, CampaignInteractive, CampaignMessageType } from "@/shared/types/database";

interface CampaignFormModalProps {
  tenantId: string;
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}

const inputClass = "w-full rounded-lg border border-adlive-border bg-white px-3 py-2 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none";
const labelClass = "mb-1 block text-xs font-semibold text-adlive-text-main";

interface ButtonDraft { kind: "reply" | "cta_url"; title: string; url: string }

export function CampaignFormModal({ tenantId, campaign, onClose, onSaved }: CampaignFormModalProps) {
  const { templates } = useCrm();
  const approvedTemplates = templates.filter((template) => template.status === "APPROVED");

  const [name, setName] = useState(campaign?.name ?? "");
  const [msgType, setMsgType] = useState<CampaignMessageType>(campaign?.msg_type ?? "text");
  const [templateName, setTemplateName] = useState(campaign?.template_name ?? "");
  const [body, setBody] = useState(campaign?.msg_type === "text" ? campaign?.body ?? "" : campaign?.interactive?.body ?? "");
  const [footer, setFooter] = useState(campaign?.interactive?.footer ?? "");
  const [buttons, setButtons] = useState<ButtonDraft[]>(
    campaign?.interactive?.buttons.map((button) => ({ kind: button.kind, title: button.title, url: button.url ?? "" })) ?? [],
  );
  const [utmSource, setUtmSource] = useState(campaign?.filters.utm_source ?? "");
  const [utmCampaign, setUtmCampaign] = useState(campaign?.filters.utm_campaign ?? "");
  const [createdFrom, setCreatedFrom] = useState(campaign?.filters.created_from ?? "");
  const [createdTo, setCreatedTo] = useState(campaign?.filters.created_to ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : "",
  );
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const countAudience = async () => {
    setCounting(true);
    setAudienceCount(null);
    let query = createClient().from("contacts").select("id", { count: "exact", head: true })
      .not("phone_e164", "is", null)
      .or("opt_out_marketing.is.null,opt_out_marketing.eq.false");
    if (utmSource.trim()) query = query.eq("utm_source", utmSource.trim());
    if (utmCampaign.trim()) query = query.eq("utm_campaign", utmCampaign.trim());
    if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00.000Z`);
    if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59.999Z`);
    const { count } = await query;
    setAudienceCount(count ?? 0);
    setCounting(false);
  };

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Escribe un nombre para la campaña."); return; }
    if (msgType === "template" && !templateName) { setError("Selecciona una plantilla aprobada."); return; }
    if (msgType !== "template" && !body.trim()) { setError("Escribe el mensaje de la campaña."); return; }
    if (msgType === "interactive" && buttons.length === 0) { setError("Agrega al menos un botón al mensaje interactivo."); return; }
    if (msgType === "interactive" && buttons.some((button) => !button.title.trim() || (button.kind === "cta_url" && !button.url.trim()))) {
      setError("Completa el título de cada botón (y la URL si es de enlace).");
      return;
    }

    const interactive: CampaignInteractive | null = msgType === "interactive"
      ? {
          body: body.trim(),
          footer: footer.trim() || undefined,
          buttons: buttons.map((button) => ({
            kind: button.kind, title: button.title.trim().slice(0, 20),
            ...(button.kind === "cta_url" ? { url: button.url.trim() } : {}),
          })),
        }
      : null;

    const scheduledIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;
    setSaving(true);
    const response = await fetch("/api/v1/campaigns", {
      method: campaign ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        ...(campaign ? { campaignId: campaign.id } : {}),
        name: name.trim(),
        msg_type: msgType,
        template_name: msgType === "template" ? templateName : null,
        body: msgType === "template" ? "" : body.trim(),
        interactive,
        filters: {
          utm_source: utmSource.trim() || undefined,
          utm_campaign: utmCampaign.trim() || undefined,
          created_from: createdFrom || undefined,
          created_to: createdTo || undefined,
        },
        scheduled_at: scheduledIso,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "No se pudo guardar la campaña.");
      return;
    }
    onSaved(name.trim());
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={campaign ? "Editar campaña" : "Nueva campaña"}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-adlive-text-main">{campaign ? "Editar campaña" : "Nueva campaña"}</h2>
            <p className="mt-0.5 text-xs text-adlive-text-muted">Guardar no envía nada: el envío se dispara solo con «Enviar ahora» o en la fecha programada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer rounded-lg p-1 text-adlive-text-muted hover:bg-adlive-canvas-bg">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="campaign-name" className={labelClass}>Nombre de la campaña</label>
            <input id="campaign-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej: Promo Plan 50GB — Noviembre" />
          </div>

          <fieldset>
            <legend className={labelClass}>Tipo de mensaje</legend>
            <div className="flex flex-wrap gap-2">
              {([["text", "Texto libre"], ["template", "Plantilla aprobada"], ["interactive", "Interactivo (botones)"]] as const).map(([value, label]) => (
                <button
                  key={value} type="button" onClick={() => setMsgType(value)}
                  aria-pressed={msgType === value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium ${msgType === value ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:bg-adlive-canvas-bg"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {msgType === "template" ? (
            <div>
              <label htmlFor="campaign-template" className={labelClass}>Plantilla (solo aprobadas por Meta)</label>
              <select id="campaign-template" className={inputClass} value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
                <option value="">Selecciona una plantilla…</option>
                {approvedTemplates.map((template) => <option key={template.id} value={template.name}>{template.name} ({template.language})</option>)}
              </select>
              {approvedTemplates.length === 0 ? <p className="mt-1 text-xs text-adlive-warning">No hay plantillas aprobadas en este workspace. Créalas en «Plantillas».</p> : null}
            </div>
          ) : (
            <div>
              <label htmlFor="campaign-body" className={labelClass}>Mensaje</label>
              <textarea id="campaign-body" className={`${inputClass} min-h-28`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={msgType === "interactive" ? 1024 : 4096} placeholder="Escribe el mensaje que recibirá cada contacto…" />
            </div>
          )}

          {msgType === "interactive" ? (
            <div className="flex flex-col gap-3 rounded-xl border border-adlive-border bg-adlive-canvas-bg p-4">
              <div>
                <label htmlFor="campaign-footer" className={labelClass}>Pie de mensaje (opcional)</label>
                <input id="campaign-footer" className={inputClass} value={footer} onChange={(event) => setFooter(event.target.value)} maxLength={60} />
              </div>
              <fieldset>
                <legend className={labelClass}>Botones (máximo 3)</legend>
                {buttons.map((button, index) => (
                  <div key={index} className="mb-2 flex flex-wrap items-center gap-2">
                    <select aria-label={`Tipo del botón ${index + 1}`} className={`${inputClass} w-36`} value={button.kind}
                      onChange={(event) => setButtons((current) => current.map((item, idx) => idx === index ? { ...item, kind: event.target.value as ButtonDraft["kind"] } : item))}>
                      <option value="reply">Respuesta rápida</option>
                      <option value="cta_url">Botón de enlace</option>
                    </select>
                    <input aria-label={`Título del botón ${index + 1}`} className={`${inputClass} flex-1`} value={button.title} maxLength={20} placeholder="Texto del botón"
                      onChange={(event) => setButtons((current) => current.map((item, idx) => idx === index ? { ...item, title: event.target.value } : item))} />
                    {button.kind === "cta_url" ? (
                      <input aria-label={`URL del botón ${index + 1}`} className={`${inputClass} flex-1`} value={button.url} placeholder="https://…"
                        onChange={(event) => setButtons((current) => current.map((item, idx) => idx === index ? { ...item, url: event.target.value } : item))} />
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setButtons((current) => current.filter((_, idx) => idx !== index))} aria-label={`Quitar botón ${index + 1}`}>Quitar</Button>
                  </div>
                ))}
                {buttons.length < 3 ? <Button size="sm" variant="secondary" onClick={() => setButtons((current) => [...current, { kind: "reply", title: "", url: "" }])}>Agregar botón</Button> : null}
              </fieldset>
            </div>
          ) : null}

          <fieldset className="rounded-xl border border-adlive-border bg-adlive-canvas-bg p-4">
            <legend className={labelClass}>Audiencia (vacío = todos los contactos con teléfono)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="filter-utm-source" className={labelClass}>Fuente (utm_source)</label>
                <input id="filter-utm-source" className={inputClass} value={utmSource} onChange={(event) => setUtmSource(event.target.value)} placeholder="Ej: meta_ads" />
              </div>
              <div>
                <label htmlFor="filter-utm-campaign" className={labelClass}>Campaña (utm_campaign)</label>
                <input id="filter-utm-campaign" className={inputClass} value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} placeholder="Ej: plan50gb" />
              </div>
              <div>
                <label htmlFor="filter-from" className={labelClass}>Registrados desde</label>
                <input id="filter-from" type="date" className={inputClass} value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
              </div>
              <div>
                <label htmlFor="filter-to" className={labelClass}>Registrados hasta</label>
                <input id="filter-to" type="date" className={inputClass} value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" variant="secondary" isLoading={counting} onClick={() => void countAudience()}>Contar audiencia</Button>
              {audienceCount !== null ? <p className="text-sm font-semibold text-adlive-text-main" role="status">{audienceCount.toLocaleString("es-CO")} contactos recibirán esta campaña</p> : null}
            </div>
          </fieldset>

          <div>
            <label htmlFor="campaign-schedule" className={labelClass}>Programar envío (opcional)</label>
            <input id="campaign-schedule" type="datetime-local" className={inputClass} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            <p className="mt-1 text-xs text-adlive-text-muted">Si eliges una fecha futura, la campaña queda «Programada» y el envío arranca solo en ese momento.</p>
          </div>

          {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-adlive-danger" role="alert">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-adlive-border pt-4">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button isLoading={saving} onClick={() => void handleSave()}>{campaign ? "Guardar cambios" : "Crear campaña"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
