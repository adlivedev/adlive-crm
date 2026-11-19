-- DESTRUCTIVO: elimina tenants y todos sus datos transaccionales.
-- No ejecutar en producción sin respaldo y autorización explícita.
-- Conserva tablas, enums, índices, funciones, políticas y platform_superadmins.
BEGIN;

SET LOCAL statement_timeout = '60s';

TRUNCATE TABLE
  public.messages,
  public.conversations,
  public.opportunities,
  public.contact_notes,
  public.contact_tasks,
  public.contact_activities,
  public.workflow_enrollments,
  public.workflows,
  public.whatsapp_templates,
  public.ai_bots,
  public.contacts,
  public.custom_field_definitions,
  public.custom_values,
  public.pipeline_stages,
  public.pipelines,
  public.tenant_integrations_vault,
  public.tenant_members,
  public.tenants
RESTART IDENTITY CASCADE;

COMMIT;
