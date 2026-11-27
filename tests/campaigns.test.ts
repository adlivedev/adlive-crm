import { describe, expect, it } from "vitest";

import { buildMassCampaignRows } from "@/features/attribution/components/attributionData";
import { applyCampaignAudienceFilters, CAMPAIGN_BATCH_SIZE } from "@/shared/services/campaignService";
import type { Opportunity } from "@/shared/types/database";

/** Query builder falso que registra cada llamada de filtro. */
function fakeQuery() {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {
    calls,
    eq(column: string, value: string) { calls.push(["eq", column, value]); return builder; },
    gte(column: string, value: string) { calls.push(["gte", column, value]); return builder; },
    lte(column: string, value: string) { calls.push(["lte", column, value]); return builder; },
    not(column: string, op: string, value: string | null) { calls.push(["not", column, op, value]); return builder; },
    or(expr: string) { calls.push(["or", expr]); return builder; },
  };
  return builder;
}

function opportunity(partial: Partial<Opportunity>): Opportunity {
  return {
    id: "o1", tenant_id: "t1", contact_id: "c1", pipeline_id: "p1", stage_id: "s1",
    title: "Venta", monetary_value: 50000, status: "won",
    assigned_member_id: null, closed_at: "2026-11-10T00:00:00Z",
    created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-10T00:00:00Z",
    ...partial,
  } as Opportunity;
}

describe("Campañas masivas — filtros de audiencia", () => {
  it("siempre excluye contactos sin teléfono y con opt-out de marketing", () => {
    const query = fakeQuery();
    applyCampaignAudienceFilters(query, {});
    expect(query.calls).toContainEqual(["not", "phone_e164", "is", null]);
    expect(query.calls).toContainEqual(["or", "opt_out_marketing.is.null,opt_out_marketing.eq.false"]);
  });

  it("sin filtros no agrega condiciones extra (audiencia = todos)", () => {
    const query = fakeQuery();
    applyCampaignAudienceFilters(query, {});
    expect(query.calls).toHaveLength(2);
  });

  it("aplica utm_source, utm_campaign y rango de fechas de creación", () => {
    const query = fakeQuery();
    applyCampaignAudienceFilters(query, {
      utm_source: " meta_ads ", utm_campaign: "plan50gb",
      created_from: "2026-11-01", created_to: "2026-11-25",
    });
    expect(query.calls).toContainEqual(["eq", "utm_source", "meta_ads"]);
    expect(query.calls).toContainEqual(["eq", "utm_campaign", "plan50gb"]);
    expect(query.calls).toContainEqual(["gte", "created_at", "2026-11-01T00:00:00.000Z"]);
    expect(query.calls).toContainEqual(["lte", "created_at", "2026-11-25T23:59:59.999Z"]);
  });

  it("el lote por defecto es pequeño para no saturar (1 por 1)", () => {
    expect(CAMPAIGN_BATCH_SIZE).toBeLessThanOrEqual(25);
  });
});

describe("Campañas masivas — atribución (buildMassCampaignRows)", () => {
  const campaigns = [
    { id: "camp-1", name: "Promo Noviembre" },
    { id: "camp-2", name: "Reactivación" },
  ];
  const sends = [
    { campaign_id: "camp-1", contact_id: "c1", status: "sent", sent_at: "2026-11-05T10:00:00Z" },
    { campaign_id: "camp-1", contact_id: "c2", status: "sent", sent_at: "2026-11-05T10:01:00Z" },
    { campaign_id: "camp-1", contact_id: "c3", status: "failed", sent_at: "2026-11-05T10:02:00Z" },
    { campaign_id: "camp-2", contact_id: "c9", status: "sent", sent_at: "2026-11-06T10:00:00Z" },
  ];

  it("cuenta solo envíos exitosos como leads y atribuye oportunidades ganadas", () => {
    const rows = buildMassCampaignRows(campaigns, sends, [
      opportunity({ id: "o1", contact_id: "c1", monetary_value: 80000 }),
      opportunity({ id: "o2", contact_id: "c2", status: "open" }),
      opportunity({ id: "o3", contact_id: "c9", monetary_value: 20000 }),
    ], null, null);
    expect(rows).toHaveLength(2);
    const promo = rows.find((row) => row.key === "camp-1");
    expect(promo).toMatchObject({ leads: 2, won: 1, wonValue: 80000 });
    expect(promo?.conversionPct).toBeCloseTo(50);
    const reactivacion = rows.find((row) => row.key === "camp-2");
    expect(reactivacion).toMatchObject({ leads: 1, won: 1, wonValue: 20000 });
  });

  it("una misma oportunidad ganada puede atribuirse a varias campañas recibidas", () => {
    const rows = buildMassCampaignRows(campaigns, [
      ...sends,
      { campaign_id: "camp-2", contact_id: "c1", status: "sent", sent_at: "2026-11-06T10:00:00Z" },
    ], [opportunity({ id: "o1", contact_id: "c1", monetary_value: 80000 })], null, null);
    expect(rows.find((row) => row.key === "camp-1")?.won).toBe(1);
    expect(rows.find((row) => row.key === "camp-2")?.won).toBe(1);
  });

  it("respeta el rango de fechas del envío y del cierre", () => {
    const rows = buildMassCampaignRows(campaigns, sends, [
      opportunity({ id: "o1", contact_id: "c1", monetary_value: 80000 }),
    ], "2026-11-06", "2026-11-30");
    /* Solo el envío de camp-2 (2026-11-06) entra al rango; el cierre (11-10) también. */
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "camp-2", leads: 1, won: 0 });
  });

  it("omite campañas sin envíos exitosos", () => {
    const rows = buildMassCampaignRows(campaigns, [
      { campaign_id: "camp-1", contact_id: "c1", status: "failed", sent_at: "2026-11-05T10:00:00Z" },
    ], [], null, null);
    expect(rows).toHaveLength(0);
  });
});
