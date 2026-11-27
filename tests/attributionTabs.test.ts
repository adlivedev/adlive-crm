import { describe, expect, it } from "vitest";

import { buildAttributionRows } from "@/features/attribution/components/attributionData";
import type { Contact } from "@/shared/types/database";

function contact(partial: Partial<Contact>): Contact {
  return {
    id: partial.id ?? "c1", tenant_id: "t1", full_name: "X", phone_e164: "+573001234567",
    email: null, company_name: null, lead_source: "Meta Ads", tags: [], custom_fields: {},
    utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
    landing_url: null, typification: null, is_starred: false, is_closed_client: false,
    assigned_member_id: null, last_interaction_at: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
    ...partial,
  } as Contact;
}

describe("TC-ATTRIBUTION — dimensiones Fuentes y Landings (QA-NEW-013)", () => {
  it("agrupa por utm_source y por landing_url acotando URL largas", () => {
    const contacts = [
      contact({ id: "c1", utm_source: "facebook", landing_url: "https://preduvyclass.pre-adlive.com/contacto?utm=1" }),
      contact({ id: "c2", utm_source: "facebook", landing_url: "https://preduvyclass.pre-adlive.com/contacto?utm=2" }),
      contact({ id: "c3", utm_source: "instagram" }),
    ];

    const sources = buildAttributionRows("sources", [], contacts, null, null);
    expect(sources[0]).toMatchObject({ name: "facebook", leads: 2 });
    expect(sources[1]).toMatchObject({ name: "instagram", leads: 1 });

    const landings = buildAttributionRows("landings", [], contacts, null, null);
    expect(landings).toHaveLength(2); /* misma landing pero URLs distintas = 2 claves */
    expect(landings[0]!.name).toBe("preduvyclass.pre-adlive.com/contacto");
    expect(landings[0]!.leads).toBe(1);
  });

  it("no inventa dimensiones vacías", () => {
    const rows = buildAttributionRows("landings", [], [contact({ id: "c1" })], null, null);
    expect(rows).toHaveLength(0);
  });
});
