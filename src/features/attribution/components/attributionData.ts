import type { Contact, Opportunity } from "@/shared/types/database";

export type AttributionTab = "campaigns" | "adsets" | "ads" | "sources" | "landings";

export interface AttributionRow {
  key: string;
  name: string;
  detail: string;
  leads: number;
  won: number;
  wonValue: number;
  conversionPct: number;
}

export function isoInRange(iso: string, from: string | null, to: string | null): boolean {
  const day = iso.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function dimension(contact: Contact, tab: AttributionTab): { key: string; name: string; detail: string } | null {
  const campaign = contact.utm_campaign?.trim();
  const adset = contact.utm_term?.trim();
  const ad = contact.utm_content?.trim();
  if (tab === "campaigns" && campaign) return { key: `campaign:${campaign}`, name: campaign, detail: [contact.utm_source, contact.utm_medium].filter(Boolean).join(" · ") || "UTM registrada" };
  if (tab === "adsets" && adset) return { key: `adset:${campaign ?? ""}:${adset}`, name: adset, detail: campaign ?? "Sin campaña UTM" };
  if (tab === "ads" && ad) return { key: `ad:${campaign ?? ""}:${adset ?? ""}:${ad}`, name: ad, detail: [campaign, adset].filter(Boolean).join(" · ") || "Contenido UTM" };
  const source = contact.utm_source?.trim();
  if (tab === "sources" && source) return { key: `source:${source}`, name: source, detail: [contact.utm_medium, campaign].filter(Boolean).join(" · ") || "Fuente UTM" };
  const landing = contact.landing_url?.trim();
  if (tab === "landings" && landing) {
    /* Mostrar URL legible (sin protocolo ni query, acotada) y mantener la clave exacta. */
    const pretty = landing.replace(/^https?:\/\//i, "").split("?")[0] ?? landing;
    return { key: `landing:${landing}`, name: pretty.length > 80 ? `${pretty.slice(0, 77)}…` : pretty, detail: [source, campaign].filter(Boolean).join(" · ") || "Landing registrada" };
  }
  return null;
}

/** Agrupa únicamente contactos reales que tienen la dimensión UTM seleccionada. */
export function buildAttributionRows(
  tab: AttributionTab,
  opportunities: Opportunity[],
  contacts: Contact[],
  from: string | null,
  to: string | null,
): AttributionRow[] {
  const groups = new Map<string, AttributionRow & { contactIds: Set<string> }>();
  for (const contact of contacts) {
    if (!isoInRange(contact.created_at, from, to)) continue;
    const value = dimension(contact, tab);
    if (!value) continue;
    const current = groups.get(value.key) ?? { ...value, leads: 0, won: 0, wonValue: 0, conversionPct: 0, contactIds: new Set<string>() };
    current.leads += 1;
    current.contactIds.add(contact.id);
    groups.set(value.key, current);
  }
  for (const opportunity of opportunities) {
    if (opportunity.status !== "won" || !opportunity.closed_at || !isoInRange(opportunity.closed_at, from, to)) continue;
    for (const group of groups.values()) {
      if (!group.contactIds.has(opportunity.contact_id)) continue;
      group.won += 1;
      group.wonValue += Number(opportunity.monetary_value);
    }
  }
  return [...groups.values()].map(({ contactIds: _contactIds, ...group }) => ({
    ...group,
    conversionPct: group.leads > 0 ? (group.won / group.leads) * 100 : 0,
  })).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
}
