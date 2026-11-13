/**
 * M11 — Datos y utilidades puras de Atribución Publicitaria.
 *
 * Los leads por creativo son el volumen real reportado por Meta Ads para el
 * lote de pauta de portabilidad (207 + 153 + 144 + 11 = 515). Las ventas
 * (ganadas y valor) se calculan EN VIVO desde las oportunidades del store
 * atribuidas por campaña UTM, por lo que cerrar una oportunidad en el Kanban
 * recalcula al instante conversión y valor ganado.
 */

import type { Contact, Opportunity } from "@/shared/types/database";

export type AttributionTab = "campaigns" | "adsets" | "ads";

export interface AttributionAd {
  id: string;
  name: string;
  adset: string;
  campaign: string;
  leads: number;
}

export const ATTRIBUTION_CAMPAIGN = "Portabilidad 50GB - Noviembre 2026";

export const ATTRIBUTION_ADS: AttributionAd[] = [
  { id: "ad-001", name: "¡50GB y tu primer mes GRATIS por solo $23.000!", adset: "Ventas - Advantage+ Shopping", campaign: ATTRIBUTION_CAMPAIGN, leads: 207 },
  { id: "ad-002", name: "¡50 GB por solo $23.000! Cámbiate hoy 📲", adset: "Ventas - Advantage+ Shopping", campaign: ATTRIBUTION_CAMPAIGN, leads: 153 },
  { id: "ad-003", name: "¡Pásate a Movistar por solo 23.000 pesos!", adset: "Remarketing - Video Testimonial", campaign: ATTRIBUTION_CAMPAIGN, leads: 144 },
  { id: "ad-004", name: "¡55 Gigas y Redes Ilimitadas por solo $38.000!", adset: "Remarketing - Video Testimonial", campaign: ATTRIBUTION_CAMPAIGN, leads: 11 },
];

export interface AttributionRow {
  key: string;
  name: string;
  detail: string;
  leads: number;
  won: number;
  wonValue: number;
  conversionPct: number;
}

/** Total de leads atribuidos del lote de pauta (515). */
export function totalAttributedLeads(): number {
  return ATTRIBUTION_ADS.reduce((sum, ad) => sum + ad.leads, 0);
}

/** true si el ISO cae en el rango [from, to] (inclusive, formato YYYY-MM-DD). */
export function isoInRange(iso: string, from: string | null, to: string | null): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Oportunidades ganadas en rango cuyo contacto pertenece a la campaña UTM. */
export function computeWonForCampaign(
  opportunities: Opportunity[],
  contacts: Contact[],
  campaign: string,
  from: string | null,
  to: string | null,
): { won: number; wonValue: number } {
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  let won = 0;
  let wonValue = 0;
  for (const opportunity of opportunities) {
    if (opportunity.status !== "won" || !opportunity.closed_at) continue;
    if (!isoInRange(opportunity.closed_at, from, to)) continue;
    const contact = contactById.get(opportunity.contact_id);
    if (!contact || contact.utm_campaign !== campaign) continue;
    won += 1;
    wonValue += opportunity.monetary_value;
  }
  return { won, wonValue };
}

/** Agrega las filas de la pestaña activa (campañas / conjuntos / anuncios). */
export function buildAttributionRows(
  tab: AttributionTab,
  opportunities: Opportunity[],
  contacts: Contact[],
  from: string | null,
  to: string | null,
): AttributionRow[] {
  const groups = new Map<string, { name: string; detail: string; campaign: string; leads: number }>();
  const push = (key: string, name: string, detail: string, campaign: string, leads: number) => {
    const existing = groups.get(key);
    if (existing) {
      existing.leads += leads;
    } else {
      groups.set(key, { name, detail, campaign, leads });
    }
  };

  for (const ad of ATTRIBUTION_ADS) {
    if (tab === "campaigns") push(ad.campaign, ad.campaign, "Meta Ads · Ventas", ad.campaign, ad.leads);
    if (tab === "adsets") push(ad.adset, ad.adset, ad.campaign, ad.campaign, ad.leads);
    if (tab === "ads") push(ad.id, ad.name, ad.adset, ad.campaign, ad.leads);
  }

  return [...groups.entries()].map(([key, group]) => {
    const { won, wonValue } = computeWonForCampaign(opportunities, contacts, group.campaign, from, to);
    return {
      key,
      name: group.name,
      detail: group.detail,
      leads: group.leads,
      won,
      wonValue,
      conversionPct: group.leads > 0 ? (won / group.leads) * 100 : 0,
    };
  });
}
