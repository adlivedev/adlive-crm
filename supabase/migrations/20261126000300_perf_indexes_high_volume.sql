-- Rendimiento con volúmenes altos (24k-80k contactos):
-- 1) Búsqueda de contactos: ampliar el índice trigrama a email y company_name
--    (la búsqueda OR del store filtra por las 4 columnas; sin índice trgm en todas,
--    Postgres cae en seq scan completo).
-- 2) Mensajes: la carga del workspace ordena por (tenant_id, created_at) limit 2000;
--    solo existía índice por (conversation_id, created_at) → seq scan + sort crecientes.
-- Aplicada a producción el 2026-11-25 vía MCP apply_migration.

CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm_v2
  ON contacts USING GIN (full_name gin_trgm_ops, phone_e164 gin_trgm_ops, email gin_trgm_ops, company_name gin_trgm_ops);
DROP INDEX IF EXISTS idx_contacts_search_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_time ON messages(tenant_id, created_at DESC);
