-- ADlive CRM: remediación de advisories de seguridad posteriores al DDL inicial.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_tenant_member(UUID) SET SCHEMA private;
ALTER FUNCTION public.is_tenant_admin(UUID) SET SCHEMA private;
ALTER FUNCTION public.current_member_id(UUID) SET SCHEMA private;
ALTER FUNCTION public.can_view_assigned(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.can_access_contact(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.can_access_conversation(UUID, UUID) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_tenant_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_tenant_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_member_id(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_view_assigned(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_contact(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_conversation(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_tenant_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_tenant_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_member_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_view_assigned(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_contact(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_conversation(UUID, UUID) TO authenticated, service_role;

-- Las políticas conservan las referencias por OID al mover las funciones.
-- owner/admin leen mediante member_select; sus políticas de escritura ya no
-- duplican el SELECT permisivo en cada fila.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenant_members', 'custom_field_definitions', 'custom_values', 'pipelines',
    'pipeline_stages', 'whatsapp_templates', 'workflows', 'ai_bots'
  ] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', table_name || '_admin_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.is_tenant_admin(tenant_id))',
      table_name || '_admin_insert', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.is_tenant_admin(tenant_id)) WITH CHECK (private.is_tenant_admin(tenant_id))',
      table_name || '_admin_update', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.is_tenant_admin(tenant_id))',
      table_name || '_admin_delete', table_name
    );
  END LOOP;
END;
$$;
