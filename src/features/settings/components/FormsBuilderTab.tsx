"use client";

/**
 * Fase 2 — Constructor de Formularios estilo HubSpot: el usuario selecciona qué
 * campos (base + personalizados) incluir, define layout (1-3 columnas), pasos
 * multi-step, bloques de texto/HTML sanitizados, colores y tipografía, y copia
 * el código de embebido con auto-height y fondo transparente.
 */

import { Copy, GripVertical, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { FORM_FONT_FAMILIES, type TenantForm } from "@/shared/lib/leadCapture";
import { useCrm } from "@/shared/services/crmStore";
import type { CustomFieldType } from "@/shared/types/database";

const SELECT_CLASS = "h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";
const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto", textarea: "Área de texto", name: "Apellido/Nombre", phone: "Teléfono (+57)", email: "Correo",
  number: "Número", select: "Dropdown", checkbox: "Checkbox", radio: "Radio", date: "Fecha", html: "Bloque HTML",
};
const BASE_FIELD_KEYS = ["first_name", "last_name", "phone", "email"];

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

interface Draft {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  columns: 1 | 2 | 3;
  is_multistep: boolean;
  fields: string[];
  html_blocks: Array<{ id: string; content_html: string }>;
  theme_config: { card_bg?: string; input_bg?: string; button_color?: string; font_family?: string };
  is_active: boolean;
}

const EMPTY_DRAFT: Draft = {
  id: null, name: "", slug: "", description: "", columns: 1, is_multistep: false,
  fields: [], html_blocks: [], theme_config: { font_family: "Inter" }, is_active: true,
};

export function FormsBuilderTab() {
  const { activeTenant, customFields } = useCrm();
  const [forms, setForms] = useState<TenantForm[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const load = () => {
    if (!activeTenant) return;
    void fetch(`/api/v1/forms?tenantId=${activeTenant.id}`).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { forms: TenantForm[] };
      setForms(result.forms);
    }).catch(() => setForms([]));
  };
  useEffect(load, [activeTenant]);

  const allFields = useMemo(() => ([
    { field_key: "first_name", field_label: "Nombre", field_type: "text" as CustomFieldType },
    { field_key: "last_name", field_label: "Apellido", field_type: "text" as CustomFieldType },
    { field_key: "phone", field_label: "Teléfono (+57)", field_type: "phone" as CustomFieldType },
    { field_key: "email", field_label: "Correo", field_type: "email" as CustomFieldType },
    ...customFields,
  ]), [customFields]);

  const isValid = draft.name.trim().length >= 2 && draft.slug.length >= 2;
  const embedUrl = draft.id && activeTenant ? `${origin}/embed/${activeTenant.slug}/form?form=${draft.slug}` : "";
  const embedCode = embedUrl ? `<iframe src="${embedUrl}" data-crm-embed title="${draft.name}" style="width:100%;border:0;overflow:hidden" scrolling="no" loading="lazy"></iframe>` : "";

  function startEdit(form: TenantForm) {
    setDraft({
      id: form.id, name: form.name, slug: form.slug, description: form.description ?? "",
      columns: form.columns, is_multistep: form.is_multistep, fields: form.fields,
      html_blocks: form.html_blocks, theme_config: form.theme_config ?? { font_family: "Inter" }, is_active: form.is_active,
    });
    setError(""); setAnnouncement(`Editando formulario «${form.name}».`);
  }

  async function save() {
    if (!activeTenant || !isValid) return;
    setSaving(true); setError("");
    try {
      const payload = {
        tenantId: activeTenant.id, slug: draft.slug, name: draft.name.trim(), description: draft.description.trim() || null,
        columns: draft.columns, is_multistep: draft.is_multistep, steps: [] as Array<{ title: string; field_keys: string[] }>,
        fields: draft.fields, html_blocks: draft.html_blocks, theme_config: draft.theme_config, is_active: draft.is_active,
      };
      const response = await fetch(draft.id ? `/api/v1/forms/${draft.id}` : "/api/v1/forms", {
        method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; form?: { id: string; slug: string } };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar.");
      setAnnouncement(`Formulario «${draft.name}» guardado.`);
      setDraft(EMPTY_DRAFT);
      load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  }

  async function remove(form: TenantForm) {
    if (!activeTenant) return;
    if (!window.confirm(`¿Eliminar el formulario «${form.name}»? Las landings que lo usen volverán al formulario por defecto.`)) return;
    const response = await fetch(`/api/v1/forms/${form.id}?tenantId=${activeTenant.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo eliminar el formulario."); return; }
    setAnnouncement(`Formulario «${form.name}» eliminado.`);
    load();
  }

  function toggleField(key: string) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.includes(key) ? current.fields.filter((item) => item !== key) : [...current.fields, key],
    }));
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setAnnouncement(`${label} copiado.`); }
    catch { setError("El navegador no permitió copiar."); }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-adlive-text-main">{draft.id ? `Editar: ${draft.name}` : "Nuevo formulario"}</h3>
            <p className="mt-1 text-xs text-adlive-text-muted">Selecciona los campos, el layout y el tema. Los campos base (nombre, teléfono, correo) siempre se incluyen aunque no estén marcados.</p>
          </div>
          {draft.id ? <Button size="sm" variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>Descartar edición</Button> : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Nombre del formulario" value={draft.name} onChange={(event) => {
            const name = event.target.value;
            setDraft((current) => ({ ...current, name, slug: current.id ? current.slug : slugify(name) }));
          }} placeholder="Ej. Captación Meta Ads" maxLength={150} />
          <Input label="Slug (identificador de la URL)" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))} placeholder="captacion-meta" hint="Solo minúsculas, números y guiones." />
          <Input label="Descripción interna (opcional)" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Para qué campaña se usa" maxLength={500} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-adlive-text-main">Columnas
            <select value={draft.columns} onChange={(event) => setDraft((current) => ({ ...current, columns: Number(event.target.value) as 1 | 2 | 3 }))} className={SELECT_CLASS}>
              <option value={1}>1 columna</option><option value={2}>2 columnas</option><option value={3}>3 columnas</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-adlive-text-main">Tipografía
            <select value={draft.theme_config.font_family ?? "Inter"} onChange={(event) => setDraft((current) => ({ ...current, theme_config: { ...current.theme_config, font_family: event.target.value } }))} className={SELECT_CLASS}>
              {FORM_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
          </label>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-adlive-text-main">
              <input type="checkbox" className="h-4 w-4 accent-adlive-primary" checked={draft.is_multistep} onChange={(event) => setDraft((current) => ({ ...current, is_multistep: event.target.checked }))} />
              Formulario por pasos (multi-step)
            </label>
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-adlive-text-main">Campos incluidos (en este orden)</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {allFields.map((field) => {
              const checked = BASE_FIELD_KEYS.includes(field.field_key) || draft.fields.includes(field.field_key);
              const locked = BASE_FIELD_KEYS.includes(field.field_key);
              return (
                <button key={field.field_key} type="button" disabled={locked} onClick={() => toggleField(field.field_key)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${locked ? "cursor-not-allowed border-adlive-border bg-adlive-canvas-bg text-adlive-text-muted" : checked ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/40"}`}>
                  {locked ? null : <GripVertical className="h-3.5 w-3.5" aria-hidden />}{field.field_label}
                  <Badge tone="neutral">{TYPE_LABELS[field.field_type] ?? field.field_type}</Badge>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-adlive-text-muted">Marcados y con color: incluidos. Los 4 campos base (grises) van siempre primero. Para reordenar, desmárcalos y vuélvelos a marcar en el orden deseado.</p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-adlive-text-main">Bloques de texto / HTML</h4>
            <Button size="sm" variant="ghost" onClick={() => setDraft((current) => ({ ...current, html_blocks: [...current.html_blocks, { id: `bloque-${Date.now()}`, content_html: "" }] }))}><Plus className="h-4 w-4" aria-hidden />Añadir bloque</Button>
          </div>
          {draft.html_blocks.length === 0 ? <p className="mt-2 text-xs text-adlive-text-muted">Sin bloques. Úsalos para títulos, beneficios o legales entre los campos (HTML básico, se sanitiza contra XSS).</p> : null}
          <div className="mt-2 flex flex-col gap-2">
            {draft.html_blocks.map((block, index) => (
              <div key={block.id} className="flex items-start gap-2">
                <textarea
                  aria-label={`Bloque HTML ${index + 1}`}
                  value={block.content_html}
                  onChange={(event) => setDraft((current) => ({ ...current, html_blocks: current.html_blocks.map((item) => item.id === block.id ? { ...item, content_html: event.target.value } : item) }))}
                  rows={3}
                  placeholder={`<h3>Beneficios de contratar hoy</h3>\n<p>Instalación gratis en 24 horas.</p>`}
                  className="w-full resize-y rounded-xl border border-adlive-border bg-white px-4 py-3 font-mono text-xs outline-none focus:border-adlive-primary"
                />
                <Button size="sm" variant="ghost" aria-label={`Eliminar bloque ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, html_blocks: current.html_blocks.filter((item) => item.id !== block.id) }))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {([
            ["card_bg", "Fondo de la tarjeta", "#FFFFFF"],
            ["input_bg", "Fondo de los campos", "#FFFFFF"],
            ["button_color", "Color del botón", ""],
          ] as const).map(([key, label, fallback]) => (
            <label key={key} className="text-center text-xs font-medium text-adlive-text-muted">
              <span className="mb-1 block text-left text-sm font-medium text-adlive-text-main">{label}</span>
              <input type="color" aria-label={label} value={draft.theme_config[key] ?? fallback ?? "#5B00FF"} onChange={(event) => setDraft((current) => ({ ...current, theme_config: { ...current.theme_config, [key]: event.target.value.toUpperCase() } }))} className="block h-10 w-full cursor-pointer rounded-lg border border-adlive-border bg-white p-1" />
            </label>
          ))}
        </div>

        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void save()} disabled={!isValid || saving} isLoading={saving}>
            <Save className="h-4 w-4" aria-hidden />{draft.id ? "Guardar cambios" : "Crear formulario"}
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-adlive-text-main">
            <input type="checkbox" className="h-4 w-4 accent-adlive-primary" checked={draft.is_active} onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))} />
            Activo
          </label>
        </div>
      </Card>

      {embedCode ? (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-adlive-text-main">Embeber «{draft.name}» en tu web</h3>
          <p className="mt-1 text-xs text-adlive-text-muted">Fondo transparente y alto automático: copia este código en tu página. La atribución UTM se captura sola incluso desde Instagram/Meta in-app.</p>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-adlive-canvas-bg px-3 py-2 text-xs text-adlive-text-main">{embedCode}</code>
            <Button size="sm" variant="secondary" onClick={() => void copy(embedCode, "Código iframe")}><Copy className="h-4 w-4" aria-hidden />Copiar código</Button>
          </div>
          <div className="mt-2"><Button size="sm" variant="ghost" onClick={() => void copy(embedUrl, "URL del formulario")}>Copiar URL</Button></div>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between px-6 py-4"><h3 className="text-sm font-semibold text-adlive-text-main">Formularios del workspace</h3>{forms === null ? <LoaderCircle className="h-4 w-4 animate-spin text-adlive-text-muted" aria-hidden /> : <Badge tone="neutral">{forms.length}</Badge>}</div>
        {forms && forms.length === 0 ? <p className="px-6 pb-5 text-sm text-adlive-text-muted">Aún no hay formularios creados.</p> : null}
        {forms && forms.length > 0 ? (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-adlive-border bg-adlive-canvas-bg text-xs uppercase tracking-wide text-adlive-text-muted"><th scope="col" className="px-6 py-3 font-semibold">Nombre</th><th scope="col" className="px-4 py-3 font-semibold">Slug</th><th scope="col" className="px-4 py-3 font-semibold">Campos</th><th scope="col" className="px-4 py-3 font-semibold">Estado</th><th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody className="divide-y divide-adlive-border">
              {forms.map((form) => (
                <tr key={form.id} className="transition-colors hover:bg-adlive-canvas-bg/60">
                  <td className="px-6 py-3.5 font-medium text-adlive-text-main">{form.name}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-adlive-text-muted">{form.slug}</td>
                  <td className="px-4 py-3.5 text-xs text-adlive-text-muted">{form.fields.length} personalizados · {form.columns} col{form.is_multistep ? " · por pasos" : ""}</td>
                  <td className="px-4 py-3.5">{form.is_active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>}</td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(form)}>Editar</Button>
                    <Button size="sm" variant="ghost" aria-label={`Eliminar formulario ${form.name}`} className="text-adlive-danger" onClick={() => void remove(form)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Card>
    </div>
  );
}
