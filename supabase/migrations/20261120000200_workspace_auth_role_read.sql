-- Iteración 09: inspección de workspaces para superadmin, solo lectura.
-- No crea membresías ni cambia los permisos de owner/admin/agent existentes.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'contacts', 'opportunities', 'conversations', 'messages',
    'contact_notes', 'contact_tasks', 'contact_activities',
    'pipelines', 'pipeline_stages', 'whatsapp_templates',
    'workflows', 'workflow_enrollments', 'ai_bots',
    'custom_field_definitions', 'custom_values'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_superadmin_select', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_superadmin())',
      table_name || '_superadmin_select', table_name
    );
  END LOOP;
END;
$$;
