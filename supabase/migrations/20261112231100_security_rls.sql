-- ADlive CRM: aislamiento multi-tenant, RBAC y Realtime privado.
CREATE UNIQUE INDEX idx_tenant_members_user_unique
  ON tenant_members(tenant_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = (SELECT auth.uid())
      AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = (SELECT auth.uid())
      AND is_active = TRUE
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_member_id(p_tenant_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.tenant_members
  WHERE tenant_id = p_tenant_id
    AND user_id = (SELECT auth.uid())
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_view_assigned(p_tenant_id UUID, p_assigned_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members AS member
    WHERE member.tenant_id = p_tenant_id
      AND member.user_id = (SELECT auth.uid())
      AND member.is_active = TRUE
      AND (
        member.role IN ('owner', 'admin')
        OR member.can_view_all_contacts = TRUE
        OR member.id = p_assigned_member_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_contact(p_tenant_id UUID, p_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contacts AS contact
    WHERE contact.tenant_id = p_tenant_id
      AND contact.id = p_contact_id
      AND public.can_view_assigned(contact.tenant_id, contact.assigned_member_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(p_tenant_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations AS conversation
    WHERE conversation.tenant_id = p_tenant_id
      AND conversation.id = p_conversation_id
      AND public.can_view_assigned(conversation.tenant_id, conversation.assigned_member_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_member_id(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_assigned(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_contact(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_conversation(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_member_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_assigned(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_contact(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(UUID, UUID) TO authenticated, service_role;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations_vault ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Sin políticas y sin privilegios de cliente: solo Service Role en servidor.
REVOKE ALL ON tenant_integrations_vault FROM anon, authenticated;

CREATE POLICY tenants_select ON tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id));
CREATE POLICY tenants_admin_update ON tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(id)) WITH CHECK (public.is_tenant_admin(id));

CREATE POLICY tenant_members_select ON tenant_members FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
CREATE POLICY tenant_members_admin_all ON tenant_members FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY contacts_select ON contacts FOR SELECT TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY contacts_insert ON contacts FOR INSERT TO authenticated
  WITH CHECK (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY contacts_update ON contacts FOR UPDATE TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id))
  WITH CHECK (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY contacts_admin_delete ON contacts FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY opportunities_select ON opportunities FOR SELECT TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY opportunities_insert ON opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.can_view_assigned(tenant_id, assigned_member_id)
    AND public.can_access_contact(tenant_id, contact_id)
  );
CREATE POLICY opportunities_update ON opportunities FOR UPDATE TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id))
  WITH CHECK (
    public.can_view_assigned(tenant_id, assigned_member_id)
    AND public.can_access_contact(tenant_id, contact_id)
  );
CREATE POLICY opportunities_admin_delete ON opportunities FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY conversations_select ON conversations FOR SELECT TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY conversations_insert ON conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.can_view_assigned(tenant_id, assigned_member_id)
    AND public.can_access_contact(tenant_id, contact_id)
  );
CREATE POLICY conversations_update ON conversations FOR UPDATE TO authenticated
  USING (public.can_view_assigned(tenant_id, assigned_member_id))
  WITH CHECK (public.can_view_assigned(tenant_id, assigned_member_id));
CREATE POLICY conversations_admin_delete ON conversations FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY messages_select ON messages FOR SELECT TO authenticated
  USING (public.can_access_conversation(tenant_id, conversation_id));
CREATE POLICY messages_insert ON messages FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_conversation(tenant_id, conversation_id)
    AND sender_member_id = public.current_member_id(tenant_id)
    AND direction = 'outbound'
  );
CREATE POLICY messages_admin_delete ON messages FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY contact_notes_select ON contact_notes FOR SELECT TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY contact_notes_insert ON contact_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_contact(tenant_id, contact_id)
    AND author_member_id = public.current_member_id(tenant_id)
  );
CREATE POLICY contact_notes_update ON contact_notes FOR UPDATE TO authenticated
  USING (
    public.can_access_contact(tenant_id, contact_id)
    AND author_member_id = public.current_member_id(tenant_id)
  )
  WITH CHECK (
    public.can_access_contact(tenant_id, contact_id)
    AND author_member_id = public.current_member_id(tenant_id)
  );
CREATE POLICY contact_notes_admin_delete ON contact_notes FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY contact_tasks_select ON contact_tasks FOR SELECT TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY contact_tasks_insert ON contact_tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY contact_tasks_update ON contact_tasks FOR UPDATE TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id))
  WITH CHECK (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY contact_tasks_admin_delete ON contact_tasks FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY contact_activities_select ON contact_activities FOR SELECT TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY contact_activities_insert ON contact_activities FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_contact(tenant_id, contact_id)
    AND actor_member_id = public.current_member_id(tenant_id)
  );
CREATE POLICY contact_activities_admin_delete ON contact_activities FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY workflow_enrollments_select ON workflow_enrollments FOR SELECT TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY workflow_enrollments_insert ON workflow_enrollments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY workflow_enrollments_update ON workflow_enrollments FOR UPDATE TO authenticated
  USING (public.can_access_contact(tenant_id, contact_id))
  WITH CHECK (public.can_access_contact(tenant_id, contact_id));
CREATE POLICY workflow_enrollments_admin_delete ON workflow_enrollments FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

-- Políticas repetibles para tablas de configuración: lectura de miembros,
-- escritura exclusiva de owner/admin. Los nombres se generan una sola vez aquí.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'custom_field_definitions', 'custom_values', 'pipelines', 'pipeline_stages',
    'whatsapp_templates', 'workflows', 'ai_bots'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id))',
      table_name || '_member_select', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id))',
      table_name || '_admin_all', table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER opportunities_set_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER whatsapp_templates_set_updated_at BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workflows_set_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER integrations_vault_set_updated_at BEFORE UPDATE ON tenant_integrations_vault
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['contacts', 'conversations', 'messages'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;
