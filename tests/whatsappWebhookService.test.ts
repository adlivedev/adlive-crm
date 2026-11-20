import { describe, expect, it, vi } from "vitest";

import { ingestWhatsAppPayload, WhatsAppChangeValidationError, whatsappPayloadSchema } from "@/shared/services/whatsappWebhookService";
import type { WhatsAppPayload } from "@/shared/services/whatsappWebhookService";

const phoneNumberId = "1331700773359404";
const from = "573172536666";
const incoming = (id = "wamid-1") => ({
  from, id, timestamp: "1763580000", type: "text", text: { body: "Hola, quiero información" },
});

function messageChange(value: Record<string, unknown> = {}) {
  return { field: "messages", value: { metadata: { phone_number_id: phoneNumberId }, messages: [incoming()], ...value } };
}

function payload(...changes: unknown[]): WhatsAppPayload {
  return whatsappPayloadSchema.parse({ object: "whatsapp_business_account", entry: [{ id: "1377453371038363", changes }] });
}

type Admin = NonNullable<Parameters<typeof ingestWhatsAppPayload>[1]>;
type Result = { data: unknown; error: { message: string } | null };
type TableResults = { select?: Result; update?: Result; single?: Result };
interface FakeQuery extends PromiseLike<Result> {
  select: () => FakeQuery;
  update: (value: unknown) => FakeQuery;
  eq: () => FakeQuery;
  filter: () => FakeQuery;
  order: () => FakeQuery;
  limit: () => FakeQuery;
  in: () => FakeQuery;
  maybeSingle: () => Promise<Result>;
}

function fakeQuery(results: TableResults, onUpdate: (value: unknown) => void): FakeQuery {
  let result = results.select ?? { data: [], error: null };
  const query: FakeQuery = {
    select: () => query,
    update: (value) => { onUpdate(value); result = results.update ?? { data: [], error: null }; return query; },
    eq: () => query,
    filter: () => query,
    order: () => query,
    limit: () => query,
    in: () => query,
    maybeSingle: async () => results.single ?? results.select ?? { data: null, error: null },
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return query;
}

function fakeAdmin(options: { tables?: Record<string, TableResults>; rpcData?: number } = {}) {
  const updates: Array<{ table: string; value: unknown }> = [];
  const from = vi.fn((table: string) => fakeQuery(options.tables?.[table] ?? {}, (value) => updates.push({ table, value })));
  const rpc = vi.fn(async (_name: string, _args: { p_phone_number_id: string; p_messages: Array<Record<string, unknown>> }) => ({ data: options.rpcData ?? 1, error: null }));
  return { client: { from, rpc } as unknown as Admin, from, rpc, updates };
}

describe("TC-WA-WEBHOOK — procesamiento por campo", () => {
  it("acepta e ignora campos no soportados sin llamar a la ingesta", async () => {
    const admin = fakeAdmin();
    const result = await ingestWhatsAppPayload(payload({ field: "calls", value: { unexpected: true } }), admin.client);
    expect(result).toMatchObject({ received: 0, inserted: 0, ignoredFields: { calls: 1 }, insertedWaMessageIds: [] });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("normaliza un mensaje entrante y conserva el nombre del perfil", async () => {
    const admin = fakeAdmin();
    const result = await ingestWhatsAppPayload(payload(messageChange({ contacts: [{ wa_id: from, profile: { name: "Contacto Nuevo" } }] })), admin.client);
    expect(result).toMatchObject({ received: 1, inserted: 1, insertedWaMessageIds: ["wamid-1"] });
    expect(admin.rpc.mock.calls[0]?.[1].p_messages[0]).toMatchObject({
      wa_message_id: "wamid-1", phone_e164: `+${from}`, full_name: "Contacto Nuevo", body: "Hola, quiero información", msg_type: "text",
    });
  });

  it.each([{ wa_id: from }, { wa_id: from, profile: { name: "   " } }])("usa un nombre de respaldo si el perfil falta o está vacío", async (contact) => {
    const admin = fakeAdmin();
    await ingestWhatsAppPayload(payload(messageChange({ contacts: [contact] })), admin.client);
    expect(admin.rpc.mock.calls[0]?.[1].p_messages[0]).toMatchObject({ full_name: `WhatsApp +${from}` });
  });

  it("procesa varios entry/changes aunque incluyan campos desconocidos", async () => {
    const admin = fakeAdmin({ rpcData: 2 });
    const input = whatsappPayloadSchema.parse({
      object: "whatsapp_business_account",
      entry: [
        { changes: [{ field: "history", value: {} }, messageChange()] },
        { changes: [messageChange({ messages: [incoming("wamid-2")] }), { field: "account_alerts", value: {} }] },
      ],
    });
    const result = await ingestWhatsAppPayload(input, admin.client);
    expect(result).toMatchObject({ received: 2, inserted: 2, ignoredFields: { history: 1, account_alerts: 1 } });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc.mock.calls[0]?.[1].p_messages).toHaveLength(2);
  });

  it("deduplica wamid repetidos dentro del mismo lote y para el bot", async () => {
    const admin = fakeAdmin();
    const result = await ingestWhatsAppPayload(payload(messageChange({ messages: [incoming(), incoming()] })), admin.client);
    expect(result.received).toBe(2);
    expect(admin.rpc.mock.calls[0]?.[1].p_messages).toHaveLength(1);
    expect(result.insertedWaMessageIds).toEqual(["wamid-1"]);
  });

  it("mantiene la idempotencia cuando el wamid ya existe", async () => {
    const admin = fakeAdmin({ rpcData: 0, tables: { messages: { select: { data: [{ wa_message_id: "wamid-1" }], error: null } } } });
    const result = await ingestWhatsAppPayload(payload(messageChange()), admin.client);
    expect(result).toMatchObject({ received: 1, inserted: 0, insertedWaMessageIds: [] });
  });

  it("rechaza un mensaje mal formado antes de escribir otra parte del lote", async () => {
    const admin = fakeAdmin();
    const input = payload(messageChange(), messageChange({ messages: [{ ...incoming("wamid-invalido"), from: "no-es-un-numero" }] }));
    await expect(ingestWhatsAppPayload(input, admin.client)).rejects.toBeInstanceOf(WhatsAppChangeValidationError);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.updates).toHaveLength(0);
  });

  it("conserva la actualización de estados de mensajes salientes", async () => {
    const admin = fakeAdmin({ tables: {
      tenant_integrations_vault: { single: { data: { tenant_id: "tenant-1" }, error: null } },
      messages: { update: { data: [{ id: "message-1" }], error: null } },
    } });
    const result = await ingestWhatsAppPayload(payload(messageChange({
      messages: undefined,
      statuses: [{ id: "wamid-out", status: "read", timestamp: "1763580000", recipient_id: from }],
    })), admin.client);
    expect(result.statusesUpdated).toBe(1);
    expect(admin.updates).toContainEqual({ table: "messages", value: { status: "read", error_reason: null } });
  });
});

describe("TC-WA-TEMPLATE — estado de plantillas", () => {
  const templateChange = (event = "APPROVED", id: string | number = 1689556908129835) => ({
    field: "message_template_status_update",
    value: {
      event, message_template_id: id, message_template_name: "bienvenida_cliente", message_template_language: "es_CO", reason: "NONE",
    },
  });

  it("resuelve el tenant por WABA y actualiza una plantilla existente", async () => {
    const admin = fakeAdmin({ tables: {
      tenant_integrations_vault: { single: { data: { tenant_id: "tenant-1" }, error: null } },
      whatsapp_templates: { update: { data: [{ id: "template-1" }], error: null } },
    } });
    const result = await ingestWhatsAppPayload(payload(templateChange()), admin.client);
    expect(result.templatesUpdated).toBe(1);
    expect(admin.updates[0]).toMatchObject({ table: "whatsapp_templates", value: { status: "APPROVED", rejection_reason: "NONE" } });
  });

  it("guarda el motivo y la recomendación de un rechazo", async () => {
    const admin = fakeAdmin({ tables: {
      tenant_integrations_vault: { single: { data: { tenant_id: "tenant-1" }, error: null } },
      whatsapp_templates: { update: { data: [{ id: "template-1" }], error: null } },
    } });
    const change = templateChange("REJECTED", "1689556908129835");
    change.value.reason = "INVALID_FORMAT";
    Object.assign(change.value, { rejection_info: { reason: "Variables juntas", recommendation: "Separar con texto" } });
    await ingestWhatsAppPayload(payload(change), admin.client);
    expect(admin.updates[0]).toMatchObject({ value: { status: "REJECTED", rejection_reason: "INVALID_FORMAT — Variables juntas Recomendación: Separar con texto" } });
  });

  it("no inventa estados para eventos de ciclo de vida aún no soportados", async () => {
    const admin = fakeAdmin();
    const result = await ingestWhatsAppPayload(payload(templateChange("UNARCHIVED")), admin.client);
    expect(result.templateEventsIgnored).toBe(1);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("no crea una plantilla incompleta si no encuentra su integración o registro", async () => {
    const admin = fakeAdmin({ tables: { tenant_integrations_vault: { single: { data: null, error: null } } } });
    const result = await ingestWhatsAppPayload(payload(templateChange()), admin.client);
    expect(result).toMatchObject({ templatesUpdated: 0, templatesUnmatched: 1 });
    expect(admin.updates).toHaveLength(0);
  });
});


describe("TC-WA-TENANT — aislamiento y atribución Click-to-WhatsApp", () => {
  it("usa la RPC estricta con tenant y línea esperados", async () => {
    const admin = fakeAdmin();
    await ingestWhatsAppPayload(payload(messageChange()), admin.client, { tenantId: "tenant-1", phoneNumberId });
    expect(admin.rpc).toHaveBeenCalledWith("ingest_whatsapp_messages_for_tenant", expect.objectContaining({
      p_tenant_id: "tenant-1", p_phone_number_id: phoneNumberId,
    }));
  });

  it("rechaza una línea distinta antes de llamar a la RPC", async () => {
    const admin = fakeAdmin();
    await expect(ingestWhatsAppPayload(payload(messageChange()), admin.client, {
      tenantId: "tenant-1", phoneNumberId: "otra-linea",
    })).rejects.toMatchObject({ name: "WhatsAppTenantMismatchError" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("normaliza referral como Meta Ads y conserva utm_source, utm_term y fbclid", async () => {
    const admin = fakeAdmin();
    const referred = { ...incoming(), referral: {
      source_type: "ad", source_id: "ad-123", ctwa_clid: "ctwa-456",
      headline: "Campaña noviembre", source_url: "https://fb.me/example",
    } };
    await ingestWhatsAppPayload(payload(messageChange({ messages: [referred] })), admin.client);
    expect(admin.rpc.mock.calls[0]?.[1].p_messages[0]).toMatchObject({
      lead_source: "Meta Ads", utm_source: "meta", utm_medium: "paid_social",
      utm_campaign: "Campaña noviembre", utm_term: "ad-123", fbclid: "ctwa-456",
      landing_url: "https://fb.me/example",
    });
  });
});
