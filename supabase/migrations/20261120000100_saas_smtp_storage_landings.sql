-- Gobernanza SaaS ADlive: workspace propio, SMTP global, landings y branding.
-- La contraseña SMTP solo se escribe desde Route Handlers autorizados; esta tabla
-- no tiene políticas para anon/authenticated y sus privilegios de cliente están revocados.

CREATE TABLE IF NOT EXISTS public.platform_smtp_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  username VARCHAR(255) NOT NULL,
  encrypted_password TEXT,
  from_name VARCHAR(150) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_smtp_settings_port_check CHECK (port BETWEEN 1 AND 65535)
);

ALTER TABLE public.platform_smtp_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_smtp_settings FROM anon, authenticated;
GRANT ALL ON public.platform_smtp_settings TO service_role;

DROP TRIGGER IF EXISTS platform_smtp_settings_set_updated_at ON public.platform_smtp_settings;
CREATE TRIGGER platform_smtp_settings_set_updated_at
  BEFORE UPDATE ON public.platform_smtp_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tenant_landings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(150) NOT NULL,
  template_key VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  subtitle TEXT,
  cta_text VARCHAR(80) NOT NULL DEFAULT 'Quiero más información',
  color_mode VARCHAR(30) NOT NULL DEFAULT 'workspace',
  custom_primary_color VARCHAR(20),
  custom_bg_color VARCHAR(20),
  custom_text_color VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_landings_tenant_slug_unique UNIQUE (tenant_id, slug),
  CONSTRAINT tenant_landings_template_check CHECK (template_key IN ('hero_split', 'minimal_lead', 'promo_offer')),
  CONSTRAINT tenant_landings_color_mode_check CHECK (color_mode IN ('workspace', 'custom'))
);

ALTER TABLE public.tenant_landings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_landings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_landings TO authenticated;

DROP POLICY IF EXISTS tenant_landings_admin_all ON public.tenant_landings;
CREATE POLICY tenant_landings_admin_all ON public.tenant_landings
  FOR ALL TO authenticated
  USING (private.is_tenant_admin(tenant_id) OR public.is_platform_superadmin())
  WITH CHECK (private.is_tenant_admin(tenant_id) OR public.is_platform_superadmin());

DROP TRIGGER IF EXISTS tenant_landings_set_updated_at ON public.tenant_landings;
CREATE TRIGGER tenant_landings_set_updated_at
  BEFORE UPDATE ON public.tenant_landings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cada landing inicial incluye su formulario de captación. Los campos base y las
-- etapas se insertan sin modificar claves, nombres o personalizaciones existentes.
CREATE OR REPLACE FUNCTION public.ensure_tenant_workspace_defaults(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Workspace no encontrado';
  END IF;

  SELECT pipeline.id INTO v_pipeline_id
  FROM public.pipelines AS pipeline
  WHERE pipeline.tenant_id = p_tenant_id
  ORDER BY pipeline.is_default DESC, pipeline.created_at ASC, pipeline.id ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.pipelines (tenant_id, name, is_default)
    VALUES (p_tenant_id, 'Pipeline Principal', true)
    RETURNING id INTO v_pipeline_id;
  END IF;

  INSERT INTO public.pipeline_stages (pipeline_id, tenant_id, name, position, stage_category)
  SELECT v_pipeline_id, p_tenant_id, stage.name, stage.position, stage.category
  FROM (VALUES
    ('Nuevo Lead', 0, 'open'::public.stage_type),
    ('Contactado', 1, 'open'::public.stage_type),
    ('Interesado', 2, 'open'::public.stage_type),
    ('Ganado', 3, 'won'::public.stage_type),
    ('Perdido', 4, 'lost'::public.stage_type)
  ) AS stage(name, position, category)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages AS existing
    WHERE existing.pipeline_id = v_pipeline_id AND existing.name = stage.name
  );

  INSERT INTO public.custom_field_definitions (
    tenant_id, field_key, field_label, field_type, options
  )
  SELECT p_tenant_id, field.key, field.label, field.kind, field.options
  FROM (VALUES
    ('operador_actual', 'Operador actual', 'select', '["Claro","Movistar","Tigo","WOM","ETB","Virgin Mobile"]'::jsonb),
    ('cedula', 'Cédula de ciudadanía', 'text', '[]'::jsonb),
    ('nip', 'NIP de portabilidad', 'text', '[]'::jsonb),
    ('direccion_envio_sim', 'Dirección de envío de la SIM', 'text', '[]'::jsonb),
    ('fecha_cita_llamada', 'Fecha de cita de llamada', 'date', '[]'::jsonb)
  ) AS field(key, label, kind, options)
  ON CONFLICT (tenant_id, field_key) DO NOTHING;

  INSERT INTO public.tenant_landings (
    tenant_id, slug, name, template_key, title, subtitle, cta_text
  )
  SELECT p_tenant_id, landing.slug, landing.name, landing.template_key,
         landing.title, landing.subtitle, landing.cta_text
  FROM (VALUES
    ('captacion-principal', 'Captación principal', 'hero_split', 'Conversemos sobre tu próxima oportunidad', 'Déjanos tus datos y un asesor te contactará.', 'Quiero más información'),
    ('formulario-minimo', 'Formulario rápido', 'minimal_lead', 'Recibe información personalizada', 'Completa el formulario y te contactaremos.', 'Quiero que me contacten'),
    ('oferta-promocional', 'Oferta promocional', 'promo_offer', 'Descubre nuestra promoción', 'Registra tus datos para conocer la oferta disponible.', 'Conocer la promoción')
  ) AS landing(slug, name, template_key, title, subtitle, cta_text)
  ON CONFLICT (tenant_id, slug) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_workspace_defaults(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_workspace_defaults(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.initialize_tenant_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_tenant_workspace_defaults(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_tenant_workspace() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_tenant_workspace() TO service_role;

DROP TRIGGER IF EXISTS tenants_initialize_workspace ON public.tenants;
CREATE TRIGGER tenants_initialize_workspace
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.initialize_tenant_workspace();

-- Conserva el aprovisionamiento original y lo hace compatible con el trigger:
-- si el pipeline o las etapas ya fueron creados, los reutiliza sin duplicarlos.
CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_name VARCHAR,
  p_slug VARCHAR,
  p_admin_email VARCHAR,
  p_admin_user_id UUID,
  p_branding JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_pipeline_id UUID;
BEGIN
  INSERT INTO public.tenants (name, slug, branding)
  VALUES (p_name, p_slug, p_branding)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_members (
    tenant_id, user_id, email, role, is_active, can_view_all_contacts
  ) VALUES (
    v_tenant_id, p_admin_user_id, lower(p_admin_email), 'owner', true, true
  );

  SELECT pipeline.id INTO v_pipeline_id
  FROM public.pipelines AS pipeline
  WHERE pipeline.tenant_id = v_tenant_id AND pipeline.is_default = true
  ORDER BY pipeline.created_at ASC, pipeline.id ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.pipelines (tenant_id, name, is_default)
    VALUES (v_tenant_id, 'Pipeline Principal', true)
    RETURNING id INTO v_pipeline_id;
  END IF;

  INSERT INTO public.pipeline_stages (
    pipeline_id, tenant_id, name, position, stage_category
  )
  SELECT v_pipeline_id, v_tenant_id, stage.name, stage.position, stage.category
  FROM (VALUES
    ('Nuevo Lead', 0, 'open'::public.stage_type),
    ('Contactado', 1, 'open'::public.stage_type),
    ('Interesado', 2, 'open'::public.stage_type),
    ('Ganado', 3, 'won'::public.stage_type),
    ('Perdido', 4, 'lost'::public.stage_type)
  ) AS stage(name, position, category)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages AS existing
    WHERE existing.pipeline_id = v_pipeline_id AND existing.name = stage.name
  );

  PERFORM public.ensure_tenant_workspace_defaults(v_tenant_id);
  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant(VARCHAR, VARCHAR, VARCHAR, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(VARCHAR, VARCHAR, VARCHAR, UUID, JSONB) TO service_role;

-- Workspace oficial de la plataforma. No se agregan superadmins a tenants clientes.
INSERT INTO public.tenants (name, slug, branding)
VALUES (
  'ADlive S.A.S',
  'adlive',
  '{
    "brand_name": "ADlive S.A.S",
    "logo_url": null,
    "logo_dark_url": null,
    "primary_color": "#5B00FF",
    "primary_hover": "#4700CC",
    "accent_color": "#29C5F6",
    "sidebar_bg": "#0A0A12",
    "canvas_bg": "#F6F7FB",
    "ink_color": "#18181B"
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenant_members (
  tenant_id, user_id, email, role, is_active, can_view_all_contacts
)
SELECT platform_tenant.id, superadmin.user_id, lower(superadmin.email),
       'owner'::public.user_role, true, true
FROM public.platform_superadmins AS superadmin
CROSS JOIN public.tenants AS platform_tenant
WHERE platform_tenant.slug = 'adlive'
ON CONFLICT (tenant_id, user_id) WHERE user_id IS NOT NULL
DO UPDATE SET
  email = EXCLUDED.email,
  role = 'owner'::public.user_role,
  is_active = true,
  can_view_all_contacts = true;

DO $$
DECLARE
  workspace RECORD;
BEGIN
  FOR workspace IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_tenant_workspace_defaults(workspace.id);
  END LOOP;
END;
$$;

-- Bucket público únicamente para lectura. El contenido permitido queda limitado
-- a imágenes rasterizadas de 2 MB; SVG y otros tipos quedan fuera también en SQL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-branding',
  'tenant-branding',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS tenant_branding_public_read ON storage.objects;
CREATE POLICY tenant_branding_public_read ON storage.objects
  FOR SELECT TO PUBLIC USING (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS tenant_branding_admin_insert ON storage.objects;
CREATE POLICY tenant_branding_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'tenant-branding'
    AND ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS tenant_branding_admin_update ON storage.objects;
CREATE POLICY tenant_branding_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS tenant_branding_admin_delete ON storage.objects;
CREATE POLICY tenant_branding_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'tenant-branding'
    AND ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );
