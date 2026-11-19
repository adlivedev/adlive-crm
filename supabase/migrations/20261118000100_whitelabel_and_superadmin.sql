-- White-label persistente, aislamiento de plataforma y aprovisionamiento atómico.
ALTER TABLE public.tenants
  ADD COLUMN branding JSONB NOT NULL DEFAULT '{
    "brand_name": "CRM",
    "logo_url": null,
    "logo_dark_url": null,
    "primary_color": "#4F46E5",
    "primary_hover": "#4338CA",
    "accent_color": "#0891B2",
    "sidebar_bg": "#111827",
    "canvas_bg": "#F3F4F6",
    "ink_color": "#111827"
  }'::jsonb,
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active';

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended')),
  ADD CONSTRAINT tenants_branding_object_check CHECK (jsonb_typeof(branding) = 'object');

UPDATE public.tenants
SET branding = jsonb_set(branding, '{brand_name}', to_jsonb(name), true)
WHERE branding->>'brand_name' = 'CRM';

CREATE TABLE public.platform_superadmins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_superadmins FROM anon;
GRANT SELECT ON public.platform_superadmins TO authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_superadmins
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;

CREATE POLICY platform_superadmins_select_self ON public.platform_superadmins
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY tenants_superadmin_all ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

CREATE POLICY tenant_members_superadmin_all ON public.tenant_members
  FOR ALL TO authenticated
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

-- Logos: /tenant-branding/{tenant_uuid}/{archivo}. Lectura pública; escritura admin.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-branding',
  'tenant-branding',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY tenant_branding_public_read ON storage.objects
  FOR SELECT TO PUBLIC USING (bucket_id = 'tenant-branding');

CREATE POLICY tenant_branding_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY tenant_branding_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY tenant_branding_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'tenant-branding'
    AND (
      public.is_platform_superadmin()
      OR private.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE OR REPLACE FUNCTION public.get_platform_tenant_metrics()
RETURNS TABLE (
  id UUID,
  name VARCHAR(150),
  slug VARCHAR(150),
  status VARCHAR(30),
  branding JSONB,
  admin_email VARCHAR(255),
  user_count BIGINT,
  contact_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    tenant.id,
    tenant.name,
    tenant.slug,
    tenant.status,
    tenant.branding,
    admin_member.email,
    (SELECT COUNT(*) FROM public.tenant_members WHERE tenant_id = tenant.id),
    (SELECT COUNT(*) FROM public.contacts WHERE tenant_id = tenant.id),
    tenant.created_at
  FROM public.tenants AS tenant
  LEFT JOIN LATERAL (
    SELECT member.email
    FROM public.tenant_members AS member
    WHERE member.tenant_id = tenant.id AND member.role IN ('owner', 'admin')
    ORDER BY member.created_at ASC
    LIMIT 1
  ) AS admin_member ON true
  WHERE public.is_platform_superadmin()
  ORDER BY tenant.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_platform_tenant_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_tenant_metrics() TO authenticated, service_role;

-- Solo la Route Handler ya autorizada ejecuta esta función con Service Role.
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

  INSERT INTO public.pipelines (tenant_id, name, is_default)
  VALUES (v_tenant_id, 'Pipeline Principal', true)
  RETURNING id INTO v_pipeline_id;

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
  ) AS stage(name, position, category);

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant(VARCHAR, VARCHAR, VARCHAR, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(VARCHAR, VARCHAR, VARCHAR, UUID, JSONB) TO service_role;

-- Bootstrap inicial (una sola vez, con el UUID real del usuario Auth de plataforma):
-- INSERT INTO public.platform_superadmins (user_id, email)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@tu-plataforma.com');
