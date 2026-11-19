import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const rls = read("supabase/migrations/20261112231100_security_rls.sql");
const ingestion = read("supabase/migrations/20261112231200_ingestion_functions.sql");
const botMigration = read("supabase/migrations/20261118000200_whatsapp_delivery_and_bot_replies.sql");

describe("TC-001 / TC-002 — contratos de aislamiento multi-tenant", () => {
  it.each(["contacts", "conversations", "opportunities", "messages", "tenant_integrations_vault"])("activa RLS en %s", (table) => {
    expect(rls).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  });

  it("retira acceso directo del navegador a la bóveda", () => {
    expect(rls).toContain("REVOKE ALL ON tenant_integrations_vault FROM anon, authenticated;");
  });

  it("restringe agentes por asignación y administradores por tenant", () => {
    expect(rls).toContain("can_view_assigned");
    expect(rls).toContain("is_tenant_admin");
    expect(rls).toContain("assigned_member_id");
  });
});

describe("TC-007 — idempotencia de WhatsApp", () => {
  it("usa wa_message_id único y DO NOTHING ante duplicados", () => {
    expect(ingestion).toContain("ON CONFLICT (wa_message_id) DO NOTHING");
    expect(ingestion).toContain("IF v_message_id IS NULL THEN");
  });

  it("permite una única respuesta automática por mensaje entrante", () => {
    expect(botMigration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_inbound_bot_reply");
    expect(botMigration).toContain("WHERE in_reply_to_message_id IS NOT NULL");
  });
});

describe("TC-013 / TC-014 — Round Robin atómico", () => {
  it("excluye agentes inactivos y no agentes", () => {
    expect(ingestion).toContain("member.is_active = TRUE");
    expect(ingestion).toContain("member.role = 'agent'");
  });

  it("serializa la selección y rota por la asignación más antigua", () => {
    expect(ingestion).toContain("ORDER BY member.last_assigned_at ASC NULLS FIRST, member.created_at ASC, member.id ASC");
    expect(ingestion).toContain("FOR UPDATE SKIP LOCKED");
    expect(ingestion).toContain("SET last_assigned_at = NOW()");
  });
});
