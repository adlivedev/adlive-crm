-- ============================================================
-- QA-NEW-004 + QA-NEW-008 — Endurecimiento final de seguridad.
-- Aplicada a producción el 2026-11-26 vía MCP apply_migration.
-- ============================================================

-- ---------- 1) Rate limiting persistente en PostgreSQL ----------
-- PROHIBIDO Map en memoria (Vercel Serverless): los contadores viven en la BD.
CREATE TABLE IF NOT EXISTS private.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION private.check_rate_limit(p_key TEXT, p_limit INT, p_window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row private.rate_limits%ROWTYPE;
BEGIN
  IF p_key IS NULL OR p_limit IS NULL OR p_window_seconds IS NULL OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN true; -- configuración inválida: nunca bloquear por defecto
  END IF;
  -- Limpieza automática de ventanas vencidas (no deja crecer la tabla).
  DELETE FROM private.rate_limits WHERE window_start < now() - make_interval(secs => p_window_seconds);
  SELECT * INTO v_row FROM private.rate_limits WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO private.rate_limits (key, window_start, count) VALUES (p_key, now(), 1)
    ON CONFLICT (key) DO UPDATE SET window_start = now(), count = 1;
    RETURN true;
  END IF;
  IF v_row.window_start < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE private.rate_limits SET window_start = now(), count = 1 WHERE key = p_key;
    RETURN true;
  END IF;
  IF v_row.count >= p_limit THEN
    RETURN false;
  END IF;
  UPDATE private.rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;

REVOKE ALL ON TABLE private.rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.check_rate_limit(TEXT, INT, INT) TO service_role;

-- ---------- 2) Storage: bucket chat-media endurecido ----------
-- Límite duro de 2 MB y tipos permitidos (incluye audio/pdf que usan los webhooks
-- con service_role; la UI de agentes mantiene su validación propia).
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','audio/ogg','audio/mpeg','audio/mp4','application/pdf']
WHERE id = 'chat-media';

-- ---------- 3) Grants de anon en tablas de Fase 1/2 ----------
REVOKE ALL ON TABLE notifications, ai_usage_logs, background_jobs, tenant_forms,
  contact_phones, contact_emails, contact_lead_history FROM anon;

-- Políticas TO public → TO authenticated (mismas expresiones, sin cambios semánticos).
DROP POLICY IF EXISTS ai_usage_logs_insert ON ai_usage_logs;
DROP POLICY IF EXISTS ai_usage_logs_select ON ai_usage_logs;
CREATE POLICY ai_usage_logs_insert ON ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY ai_usage_logs_select ON ai_usage_logs FOR SELECT TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());

DROP POLICY IF EXISTS background_jobs_delete ON background_jobs;
DROP POLICY IF EXISTS background_jobs_insert ON background_jobs;
DROP POLICY IF EXISTS background_jobs_select ON background_jobs;
DROP POLICY IF EXISTS background_jobs_update ON background_jobs;
CREATE POLICY background_jobs_insert ON background_jobs FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY background_jobs_select ON background_jobs FOR SELECT TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY background_jobs_update ON background_jobs FOR UPDATE TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY background_jobs_delete ON background_jobs FOR DELETE TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());

DROP POLICY IF EXISTS contact_emails_delete ON contact_emails;
DROP POLICY IF EXISTS contact_emails_insert ON contact_emails;
DROP POLICY IF EXISTS contact_emails_select ON contact_emails;
DROP POLICY IF EXISTS contact_emails_superadmin ON contact_emails;
CREATE POLICY contact_emails_insert ON contact_emails FOR INSERT TO authenticated
  WITH CHECK (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_emails.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_emails.contact_id))));
CREATE POLICY contact_emails_select ON contact_emails FOR SELECT TO authenticated
  USING (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_emails.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_emails.contact_id))));
CREATE POLICY contact_emails_superadmin ON contact_emails FOR SELECT TO authenticated
  USING (is_platform_superadmin());
CREATE POLICY contact_emails_delete ON contact_emails FOR DELETE TO authenticated
  USING (private.is_tenant_admin(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_emails.contact_id))));

DROP POLICY IF EXISTS contact_lead_history_insert ON contact_lead_history;
DROP POLICY IF EXISTS contact_lead_history_select ON contact_lead_history;
DROP POLICY IF EXISTS contact_lead_history_superadmin ON contact_lead_history;
CREATE POLICY contact_lead_history_insert ON contact_lead_history FOR INSERT TO authenticated
  WITH CHECK (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_lead_history.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_lead_history.contact_id))));
CREATE POLICY contact_lead_history_select ON contact_lead_history FOR SELECT TO authenticated
  USING (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_lead_history.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_lead_history.contact_id))));
CREATE POLICY contact_lead_history_superadmin ON contact_lead_history FOR SELECT TO authenticated
  USING (is_platform_superadmin());

DROP POLICY IF EXISTS contact_phones_delete ON contact_phones;
DROP POLICY IF EXISTS contact_phones_insert ON contact_phones;
DROP POLICY IF EXISTS contact_phones_select ON contact_phones;
DROP POLICY IF EXISTS contact_phones_superadmin ON contact_phones;
CREATE POLICY contact_phones_insert ON contact_phones FOR INSERT TO authenticated
  WITH CHECK (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_phones.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_phones.contact_id))));
CREATE POLICY contact_phones_select ON contact_phones FOR SELECT TO authenticated
  USING (private.can_view_assigned(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_phones.contact_id)), ( SELECT c.assigned_member_id FROM contacts c WHERE (c.id = contact_phones.contact_id))));
CREATE POLICY contact_phones_superadmin ON contact_phones FOR SELECT TO authenticated
  USING (is_platform_superadmin());
CREATE POLICY contact_phones_delete ON contact_phones FOR DELETE TO authenticated
  USING (private.is_tenant_admin(( SELECT c.tenant_id FROM contacts c WHERE (c.id = contact_phones.contact_id))));

DROP POLICY IF EXISTS notifications_insert ON notifications;
DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id) OR is_platform_superadmin() OR (recipient_member_id = private.current_member_id(tenant_id)));
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
  USING ((recipient_member_id = private.current_member_id(tenant_id)) OR private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
  USING ((recipient_member_id = private.current_member_id(tenant_id)) OR private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
-- Política DELETE nueva: destinatario o administrador del tenant.
CREATE POLICY notifications_delete ON notifications FOR DELETE TO authenticated
  USING ((recipient_member_id = private.current_member_id(tenant_id)) OR private.is_tenant_admin(tenant_id) OR is_platform_superadmin());

DROP POLICY IF EXISTS tenant_forms_delete ON tenant_forms;
DROP POLICY IF EXISTS tenant_forms_insert ON tenant_forms;
DROP POLICY IF EXISTS tenant_forms_select ON tenant_forms;
DROP POLICY IF EXISTS tenant_forms_update ON tenant_forms;
CREATE POLICY tenant_forms_insert ON tenant_forms FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY tenant_forms_select ON tenant_forms FOR SELECT TO authenticated
  USING (private.can_view_assigned(tenant_id, NULL::uuid));
CREATE POLICY tenant_forms_update ON tenant_forms FOR UPDATE TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());
CREATE POLICY tenant_forms_delete ON tenant_forms FOR DELETE TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR is_platform_superadmin());

-- ---------- 4) pg_cron: la función disparadora no es invocable por roles de cliente ----------
REVOKE ALL ON FUNCTION private.trigger_crm_process_jobs() FROM PUBLIC, anon, authenticated;

-- ---------- 5) Índices faltantes sobre llaves foráneas nuevas (QA-NEW-010) ----------
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_bot ON ai_usage_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_contact_phones_contact ON contact_phones(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_emails_contact ON contact_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_contact ON contact_lead_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_member_id);
CREATE INDEX IF NOT EXISTS idx_tenant_landings_form ON tenant_landings(form_id);
CREATE INDEX IF NOT EXISTS idx_tenants_default_bot ON tenants(default_bot_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant_status ON background_jobs(tenant_id, status, run_after);
