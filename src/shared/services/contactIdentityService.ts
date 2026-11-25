import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";

interface LeadIdentity {
  tenantId: string;
  contactId: string;          // contacto devuelto por el RPC de ingesta
  phoneE164: string;
  email: string | null;
  source: string;             // 'form' | 'webhook' | 'whatsapp' | 'manual' | 'merge' | 'import'
  detail?: string;
  payload?: Record<string, unknown>;
}

/** Extrae la atribución UTM plana que guardamos en columnas propias. */
function utmFrom(payload: Record<string, unknown> | undefined): Record<string, string | null> {
  const utm = (payload?.utm ?? payload) as Record<string, unknown> | undefined;
  /* Acepta ambas convenciones: claves oficiales utm_* o cortas (source/medium). */
  const pick = (key: string) => {
    const short = key.replace(/^utm_/, "");
    const value = utm?.[key] ?? utm?.[short];
    return typeof value === "string" ? value : null;
  };
  return {
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
  };
}

/**
 * Deduplicación estilo HubSpot tras la ingesta de un lead:
 * - Si el teléfono ya existía (upsert del RPC) solo enriquecemos: correo
 *   adicional en contact_emails + entrada en contact_lead_history.
 * - Si el correo ya pertenecía a OTRO contacto (mismo email + teléfono nuevo),
 *   se fusiona: teléfono y correo al contacto ganador, conversaciones y
 *   oportunidades movidas, historial registrado y el duplicado eliminado.
 * Devuelve el contactId definitivo (ganador si hubo fusión).
 */
export async function consolidateLeadIdentity(lead: LeadIdentity): Promise<string> {
  const admin = createAdminClient();

  /* Registro de historial siempre (origen de los datos del lead). */
  const utm = utmFrom(lead.payload);
  await admin.from("contact_lead_history").insert({
    tenant_id: lead.tenantId,
    contact_id: lead.contactId,
    source: lead.source,
    detail: lead.detail ?? `Lead recibido por ${lead.source}.`,
    payload: lead.payload ?? {},
    form_name: typeof lead.payload?.form_name === "string" ? lead.payload.form_name : null,
    submitted_phone: lead.phoneE164,
    submitted_email: lead.email,
    ...utm,
  });

  await admin.from("contact_phones").upsert(
    { tenant_id: lead.tenantId, contact_id: lead.contactId, phone_e164: lead.phoneE164, is_primary: true, source: lead.source },
    { onConflict: "tenant_id,phone_e164", ignoreDuplicates: true },
  );

  if (lead.email) {
    const email = lead.email.toLowerCase();
    /* El índice único es (tenant_id, lower(email)): insert directo y se
       ignora el error de duplicado (no usable con onConflict de PostgREST). */
    await admin.from("contact_emails").insert({
      tenant_id: lead.tenantId, contact_id: lead.contactId, email, is_primary: true, source: lead.source,
    }).then(({ error }) => { if (error && error.code !== "23505") console.error("contact_emails insert failed", error.message); });

    /* Mismo correo + teléfono nuevo → fusionar en el contacto original. */
    const { data: winner } = await admin.from("contacts")
      .select("id")
      .eq("tenant_id", lead.tenantId)
      .ilike("email", email)
      .neq("id", lead.contactId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (winner) {
      await admin.from("contact_phones").upsert(
        { tenant_id: lead.tenantId, contact_id: winner.id, phone_e164: lead.phoneE164, is_primary: false, source: "merge" },
        { onConflict: "tenant_id,phone_e164", ignoreDuplicates: true },
      );
      await admin.from("contact_emails").insert({
        tenant_id: lead.tenantId, contact_id: winner.id, email, is_primary: true, source: "merge",
      }).then(({ error }) => { if (error && error.code !== "23505") console.error("contact_emails insert failed", error.message); });
      await admin.from("contact_lead_history").insert({
        tenant_id: lead.tenantId,
        contact_id: winner.id,
        source: "merge",
        detail: `Se fusionó un lead duplicado (${lead.phoneE164}) con este contacto por correo coincidente.`,
        payload: lead.payload ?? {},
      });
      await admin.from("conversations").update({ contact_id: winner.id }).eq("tenant_id", lead.tenantId).eq("contact_id", lead.contactId);
      await admin.from("opportunities").update({ contact_id: winner.id }).eq("tenant_id", lead.tenantId).eq("contact_id", lead.contactId);
      await admin.from("contacts").delete().eq("tenant_id", lead.tenantId).eq("id", lead.contactId);
      return winner.id;
    }
  }

  return lead.contactId;
}
