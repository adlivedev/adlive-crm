"use client";

/**
 * M-Campañas — Envíos masivos por WhatsApp (`/campanas`).
 * Crea/edita/programa/elimina campañas (borradores) y dispara el envío
 * 1 por 1 vía la cola de jobs del cron. Solo admins del workspace.
 */

import { CalendarClock, ChevronDown, ChevronUp, Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, type BadgeTone } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatRelativeTime } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/client";
import { useCrm } from "@/shared/services/crmStore";
import type { Campaign, CampaignStatus } from "@/shared/types/database";

import { CampaignFormModal } from "./CampaignFormModal";

const STATUS_META: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  scheduled: { label: "Programada", tone: "cyan" },
  sending: { label: "Enviando…", tone: "warning" },
  sent: { label: "Enviada", tone: "success" },
  failed: { label: "Con fallos", tone: "danger" },
};

const MSG_TYPE_LABELS = { template: "Plantilla", text: "Texto libre", interactive: "Interactivo" } as const;

interface SendLogRow {
  id: string;
  status: string;
  error: string | null;
  sent_at: string;
  contactName: string;
  contactPhone: string | null;
}

export function CampaignsView() {
  const { activeTenant, activeMember, isPlatformSuperadmin } = useCrm();
  const canManage = isPlatformSuperadmin || activeMember?.role === "owner" || activeMember?.role === "admin";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [logRows, setLogRows] = useState<SendLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async () => {
    if (!activeTenant) return;
    setLoading(true);
    const response = await fetch(`/api/v1/campaigns?tenantId=${activeTenant.id}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { campaigns?: Campaign[]; error?: string } | null;
    if (!response.ok) setError(payload?.error ?? "No se pudieron cargar las campañas.");
    else { setCampaigns(payload?.campaigns ?? []); setError(""); }
    setLoading(false);
  }, [activeTenant]);

  useEffect(() => { void load(); }, [load]);

  /* Mientras haya una campaña enviando, refresca los contadores cada 15 s. */
  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.status === "sending")) return;
    const timer = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(timer);
  }, [campaigns, load]);

  const toggleLog = async (campaign: Campaign) => {
    if (logFor === campaign.id) { setLogFor(null); return; }
    setLogFor(campaign.id);
    setLogLoading(true);
    const supabase = createClient();
    const { data: sends } = await supabase.from("campaign_sends")
      .select("id,contact_id,status,error,sent_at")
      .eq("campaign_id", campaign.id).order("sent_at", { ascending: false }).limit(200);
    const contactIds = [...new Set((sends ?? []).map((send) => send.contact_id as string))];
    const nameByContact = new Map<string, { full_name: string; phone_e164: string | null }>();
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase.from("contacts").select("id,full_name,phone_e164").in("id", contactIds);
      for (const contact of contacts ?? []) nameByContact.set(contact.id as string, { full_name: contact.full_name as string, phone_e164: contact.phone_e164 as string | null });
    }
    setLogRows((sends ?? []).map((send) => ({
      id: send.id as string, status: send.status as string, error: send.error as string | null, sent_at: send.sent_at as string,
      contactName: nameByContact.get(send.contact_id as string)?.full_name ?? "Contacto eliminado",
      contactPhone: nameByContact.get(send.contact_id as string)?.phone_e164 ?? null,
    })));
    setLogLoading(false);
  };

  const handleSendNow = async (campaign: Campaign) => {
    if (!activeTenant) return;
    setSendingId(campaign.id);
    const response = await fetch("/api/v1/campaigns/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: activeTenant.id, campaignId: campaign.id }),
    });
    if (response.ok) setAnnouncement(`Envío de «${campaign.name}» iniciado. Se enviará 1 por 1 en segundo plano.`);
    else setAnnouncement("No se pudo iniciar el envío.");
    setConfirmSendId(null);
    setSendingId(null);
    void load();
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!activeTenant) return;
    const response = await fetch(`/api/v1/campaigns?tenantId=${activeTenant.id}&campaignId=${campaign.id}`, { method: "DELETE" });
    if (response.ok) setAnnouncement(`Campaña «${campaign.name}» eliminada.`);
    else setAnnouncement("No se pudo eliminar la campaña.");
    setDeletingId(null);
    if (logFor === campaign.id) setLogFor(null);
    void load();
  };

  const filtersSummary = (campaign: Campaign): string => {
    const parts: string[] = [];
    if (campaign.filters.utm_source) parts.push(`utm_source=${campaign.filters.utm_source}`);
    if (campaign.filters.utm_campaign) parts.push(`utm_campaign=${campaign.filters.utm_campaign}`);
    if (campaign.filters.created_from) parts.push(`desde ${campaign.filters.created_from}`);
    if (campaign.filters.created_to) parts.push(`hasta ${campaign.filters.created_to}`);
    return parts.length > 0 ? parts.join(" · ") : "Todos los contactos";
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Campañas masivas</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">Envía mensajes de WhatsApp a grupos de contactos, de 1 en 1 y con registro completo de resultados.</p>
        </div>
        {canManage ? <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" aria-hidden />Nueva campaña</Button> : null}
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-adlive-border bg-adlive-card-bg px-5 py-4">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-adlive-primary" aria-hidden />
        <p className="text-sm leading-6 text-adlive-text-main">
          <strong className="font-semibold">Cómo funciona:</strong> crea la campaña (no se envía nada al guardar), filtra tu audiencia y usa
          <strong className="font-semibold"> «Enviar ahora»</strong> o programa una fecha. El envío se hace 1 por 1 en segundo plano para no saturar,
          y cada contacto queda con el registro en su historial. Se excluyen automáticamente los contactos sin teléfono o que pidieron no recibir mensajes.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-adlive-danger" role="alert">{error}</p> : null}
      {loading ? <Card className="p-6 text-sm text-adlive-text-muted">Cargando campañas…</Card> : null}
      {!loading && campaigns.length === 0 ? (
        <Card className="p-6 text-sm text-adlive-text-muted">Aún no hay campañas. Pulsa <strong>+ Nueva campaña</strong> para crear la primera.</Card>
      ) : null}

      <ul className="flex flex-col gap-3" role="list">
        {campaigns.map((campaign) => {
          const meta = STATUS_META[campaign.status];
          const editable = campaign.status === "draft" || campaign.status === "scheduled";
          return (
            <li key={campaign.id}>
              <Card className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-adlive-text-main">{campaign.name}</h3>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <Badge tone="neutral">{MSG_TYPE_LABELS[campaign.msg_type]}</Badge>
                      {campaign.status === "sending" || campaign.status === "sent" || campaign.status === "failed" ? (
                        <Badge tone="neutral">{campaign.sent_count} enviados · {campaign.failed_count} fallidos</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-adlive-text-muted">Audiencia: {filtersSummary(campaign)}</p>
                    <p className="mt-1 text-xs text-adlive-text-muted">
                      {campaign.status === "scheduled" && campaign.scheduled_at
                        ? `Programada para ${new Date(campaign.scheduled_at).toLocaleString("es-CO")}`
                        : `Creada ${formatRelativeTime(campaign.created_at)}`}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {editable ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => { setEditing(campaign); setModalOpen(true); }} aria-label={`Editar ${campaign.name}`}>
                            <Pencil className="h-4 w-4" aria-hidden />Editar
                          </Button>
                          {confirmSendId === campaign.id ? (
                            <span className="flex items-center gap-2" role="group" aria-label={`Confirmar envío de ${campaign.name}`}>
                              <Button size="sm" variant="danger" isLoading={sendingId === campaign.id} onClick={() => void handleSendNow(campaign)}>Confirmar envío</Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmSendId(null)}>Cancelar</Button>
                            </span>
                          ) : (
                            <Button size="sm" onClick={() => setConfirmSendId(campaign.id)} aria-label={`Enviar ahora ${campaign.name}`}>
                              <Send className="h-4 w-4" aria-hidden />Enviar ahora
                            </Button>
                          )}
                          {deletingId === campaign.id ? (
                            <span className="flex items-center gap-2" role="group" aria-label={`Confirmar eliminación de ${campaign.name}`}>
                              <Button size="sm" variant="danger" onClick={() => void handleDelete(campaign)}>Eliminar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Cancelar</Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setDeletingId(campaign.id)} aria-label={`Eliminar ${campaign.name}`}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          )}
                        </>
                      ) : null}
                      {campaign.scheduled_at && campaign.status === "scheduled" ? <CalendarClock className="h-4 w-4 text-adlive-primary" aria-hidden /> : null}
                      <Button size="sm" variant="ghost" onClick={() => void toggleLog(campaign)} aria-expanded={logFor === campaign.id} aria-label={`Ver registro de envíos de ${campaign.name}`}>
                        {logFor === campaign.id ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                        Registro
                      </Button>
                    </div>
                  ) : null}
                </div>
                {logFor === campaign.id ? (
                  <div className="rounded-xl border border-adlive-border bg-adlive-canvas-bg p-4" role="region" aria-label={`Registro de envíos de ${campaign.name}`}>
                    {logLoading ? <p className="text-sm text-adlive-text-muted">Cargando registro…</p> : null}
                    {!logLoading && logRows.length === 0 ? <p className="text-sm text-adlive-text-muted">Aún no hay envíos registrados para esta campaña.</p> : null}
                    {!logLoading && logRows.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-xs text-adlive-text-muted">
                              <th className="pb-2 pr-3 font-medium">Contacto</th>
                              <th className="pb-2 pr-3 font-medium">Teléfono</th>
                              <th className="pb-2 pr-3 font-medium">Estado</th>
                              <th className="pb-2 pr-3 font-medium">Fecha</th>
                              <th className="pb-2 font-medium">Detalle</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logRows.map((row) => (
                              <tr key={row.id} className="border-t border-adlive-border">
                                <td className="py-2 pr-3 text-adlive-text-main">{row.contactName}</td>
                                <td className="py-2 pr-3 font-mono text-xs text-adlive-text-muted">{row.contactPhone ?? "—"}</td>
                                <td className="py-2 pr-3">
                                  <Badge tone={row.status === "sent" ? "success" : row.status === "failed" ? "danger" : "neutral"}>
                                    {row.status === "sent" ? "Enviado" : row.status === "failed" ? "Falló" : "Omitido"}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-3 text-xs text-adlive-text-muted">{new Date(row.sent_at).toLocaleString("es-CO")}</td>
                                <td className="py-2 text-xs text-adlive-danger">{row.error ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      {modalOpen && activeTenant ? (
        <CampaignFormModal
          tenantId={activeTenant.id}
          campaign={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={(name) => { setAnnouncement(`Campaña «${name}» guardada (sin enviar).`); setModalOpen(false); setEditing(null); void load(); }}
        />
      ) : null}
    </div>
  );
}
