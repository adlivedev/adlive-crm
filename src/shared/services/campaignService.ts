import "server-only";

import { sendMetaInteractive, sendMetaTemplate, sendMetaText } from "@/shared/lib/metaWhatsAppClient";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { buildTemplateVariables } from "@/shared/lib/whatsapp";
import type { Campaign, CampaignFilters, CampaignSendStatus, Contact } from "@/shared/types/database";

type Admin = ReturnType<typeof createAdminClient>;

/** Tamaño del lote por ejecución del worker (envíos 1 por 1, sin saturar). */
export const CAMPAIGN_BATCH_SIZE = 10;

/* Estructura mínima del query builder de Supabase; evita que tsc expanda los
   genéricos profundos del cliente real al componer filtros + limit. */
interface FilterableQuery {
  eq: (col: string, value: string) => FilterableQuery;
  gte: (col: string, value: string) => FilterableQuery;
  lte: (col: string, value: string) => FilterableQuery;
  not: (col: string, op: string, value: string | null) => FilterableQuery;
  or: (expr: string) => FilterableQuery;
  limit: (n: number) => PromiseLike<{ data: Array<{ id: string }> | null; error: unknown }>;
}
/** Pausa entre envíos individuales para no golpear la API de Meta. */
const SEND_DELAY_MS = 400;

/**
 * Aplica los filtros de audiencia de la campaña a una consulta de contactos.
 * Función pura: recibe un query builder y devuelve otro con los filtros.
 * Siempre se excluyen los contactos con opt-out de marketing y sin teléfono.
 */
export function applyCampaignAudienceFilters<T extends {
  eq: (col: string, value: string) => T;
  gte: (col: string, value: string) => T;
  lte: (col: string, value: string) => T;
  not: (col: string, op: string, value: string | null) => T;
  or: (expr: string) => T;
}>(query: T, filters: CampaignFilters): T {
  let next = query.not("phone_e164", "is", null);
  next = next.or("opt_out_marketing.is.null,opt_out_marketing.eq.false");
  if (filters.utm_source?.trim()) next = next.eq("utm_source", filters.utm_source.trim());
  if (filters.utm_campaign?.trim()) next = next.eq("utm_campaign", filters.utm_campaign.trim());
  if (filters.created_from?.trim()) next = next.gte("created_at", `${filters.created_from.trim()}T00:00:00.000Z`);
  if (filters.created_to?.trim()) next = next.lte("created_at", `${filters.created_to.trim()}T23:59:59.999Z`);
  return next;
}

/** Encola el job de envío masivo (un lote por ejecución del cron de 5 min). */
export async function enqueueCampaignSend(tenantId: string, campaignId: string, runAfter: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("background_jobs").insert({
    tenant_id: tenantId,
    job_type: "campaign_send_batch",
    payload: { campaign_id: campaignId, batch_size: CAMPAIGN_BATCH_SIZE },
    run_after: runAfter,
  });
  if (error) throw new Error(error.message);
}

async function ensureCampaignConversation(admin: Admin, tenantId: string, contact: Contact): Promise<string> {
  const { data: existing } = await admin.from("conversations").select("id")
    .eq("tenant_id", tenantId).eq("contact_id", contact.id)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await admin.from("conversations").insert({
    tenant_id: tenantId, contact_id: contact.id, assigned_member_id: contact.assigned_member_id,
    channel: "whatsapp", handler_mode: "human",
  }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "sin id");
  return created.id as string;
}

/** Envía el mensaje de la campaña a UN contacto. Devuelve el wa_message_id. */
async function sendCampaignMessage(admin: Admin, campaign: Campaign, contact: Contact): Promise<string> {
  if (campaign.msg_type === "template") {
    const { data: template } = await admin.from("whatsapp_templates")
      .select("name,language,body_text,variables_count,status")
      .eq("tenant_id", campaign.tenant_id).eq("name", campaign.template_name ?? "").eq("status", "APPROVED").maybeSingle();
    if (!template) throw new Error(`La plantilla "${campaign.template_name}" no existe o no está aprobada.`);
    const variables = buildTemplateVariables(contact, template.variables_count as number);
    if (variables.some((value) => !value)) throw new Error("Faltan valores variable_N del contacto para la plantilla.");
    return sendMetaTemplate(campaign.tenant_id, contact.phone_e164, { name: template.name as string, language: template.language as string }, variables);
  }
  if (campaign.msg_type === "interactive") {
    const ix = campaign.interactive;
    if (!ix || ix.buttons.length === 0) throw new Error("El mensaje interactivo no tiene botones configurados.");
    return sendMetaInteractive(campaign.tenant_id, contact.phone_e164, {
      body: ix.body, footer: ix.footer ?? null,
      buttons: ix.buttons.map((button) => ({ kind: button.kind, title: button.title.slice(0, 20), url: button.url })),
    });
  }
  return sendMetaText(campaign.tenant_id, contact.phone_e164, campaign.body);
}

/**
 * Procesa un LOTE del envío masivo: contactos de la audiencia que aún no
 * tienen registro en campaign_sends, enviados de 1 en 1. Si quedan
 * pendientes, se auto-reencola para el siguiente ciclo del cron; si ya no
 * quedan, marca la campaña como «sent».
 * Solo el worker (cron) llama a esta función, con service_role.
 */
export async function processCampaignSendBatch(tenantId: string, campaignId: string, batchSize = CAMPAIGN_BATCH_SIZE): Promise<void> {
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("*")
    .eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
  const row = campaign as Campaign | null;
  if (!row || (row.status !== "sending" && row.status !== "scheduled")) return;
  if (row.status === "scheduled") {
    await admin.from("campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", row.id);
  }

  /* Contactos ya procesados (enviados/fallidos/omitidos). */
  const { data: already } = await admin.from("campaign_sends").select("contact_id")
    .eq("campaign_id", campaignId).limit(10000);
  const doneIds = new Set((already ?? []).map((send) => send.contact_id as string));

  /* Audiencia: se trae un bloque amplio y se filtran los ya procesados. */
  const audienceQuery = applyCampaignAudienceFilters(
    admin.from("contacts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: true }),
    row.filters ?? {},
  ).limit(500);
  const { data: audience, error: audienceError } = await audienceQuery;
  if (audienceError) throw new Error(audienceError.message);
  const pending = ((audience ?? []) as Contact[]).filter((contact) => !doneIds.has(contact.id)).slice(0, batchSize);

  let sentDelta = 0;
  let failedDelta = 0;
  for (const contact of pending) {
    let status: CampaignSendStatus = "sent";
    let errorMessage: string | null = null;
    try {
      const waMessageId = await sendCampaignMessage(admin, row, contact);
      const conversationId = await ensureCampaignConversation(admin, tenantId, contact);
      await admin.from("messages").insert({
        tenant_id: tenantId, conversation_id: conversationId, sender_member_id: null,
        direction: "outbound", msg_type: row.msg_type, body: row.body.slice(0, 4096),
        template_name: row.template_name, wa_message_id: waMessageId, status: "sent",
      });
      await admin.from("conversations").update({
        last_message_at: new Date().toISOString(), last_message_preview: row.body.slice(0, 120),
        last_message_media_type: row.msg_type, needs_reply: false, unread_count: 0,
      }).eq("id", conversationId);
      /* Historial del contacto: la campaña queda en su línea de tiempo (Ficha 360°). */
      await admin.from("contact_activities").insert({
        tenant_id: tenantId, contact_id: contact.id, actor_member_id: null,
        activity_type: "campaign", description: `Campaña «${row.name}» enviada por WhatsApp.`,
        metadata: { campaign_id: campaignId },
      });
      await admin.from("contacts").update({ last_interaction_at: new Date().toISOString() }).eq("id", contact.id);
      sentDelta += 1;
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Error de envío";
      failedDelta += 1;
    }
    /* unique(campaign_id, contact_id) → si por reintento ya existe, se ignora. */
    await admin.from("campaign_sends").insert({
      tenant_id: tenantId, campaign_id: campaignId, contact_id: contact.id,
      status, error: errorMessage,
    }).then(({ error: logError }) => { if (logError && logError.code !== "23505") console.error("[campaign_sends]", logError.message); });
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  if (sentDelta + failedDelta > 0) {
    await admin.from("campaigns").update({
      sent_count: row.sent_count + sentDelta,
      failed_count: row.failed_count + failedDelta,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
  }

  /* ¿Quedan contactos por procesar? Volver a encolar el siguiente lote. */
  const remaining = ((audience ?? []) as Contact[]).filter((contact) => !doneIds.has(contact.id)).length - pending.length;
  const exhaustedBlock = (audience ?? []).length < 500;
  const hasMore = remaining > 0 || (!exhaustedBlock && pending.length > 0);
  if (hasMore) {
    await enqueueCampaignSend(tenantId, campaignId, new Date(Date.now() + 10_000).toISOString());
  } else {
    /* Auditoría: si el bloque quedó corto pero podría haber más audiencia, una
       pasada final sin pendientes confirma el cierre. */
    const { data: finalCheck } = await applyCampaignAudienceFilters(
      admin.from("contacts").select("id").eq("tenant_id", tenantId) as unknown as FilterableQuery,
      row.filters ?? {},
    ).limit(10000);
    const stillPending = (finalCheck ?? []).some((contact) => !doneIds.has(contact.id as string) && !pending.some((item) => item.id === (contact.id as string)));
    if (stillPending) {
      await enqueueCampaignSend(tenantId, campaignId, new Date(Date.now() + 10_000).toISOString());
      return;
    }
    await admin.from("campaigns").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", row.id);
  }
}
