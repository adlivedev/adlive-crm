-- Captura de leads aislada por tenant, campos personalizados y oportunidad inicial.
-- Conserva ingest_web_lead para el webhook legacy.

CREATE OR REPLACE FUNCTION public.ingest_tenant_web_lead(
  p_tenant_id UUID,
  p_public_webhook_token TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone_e164 TEXT,
  p_email TEXT,
  p_custom_fields JSONB,
  p_lead_source TEXT,
  p_utm_source TEXT,
  p_utm_medium TEXT,
  p_utm_campaign TEXT,
  p_utm_content TEXT,
  p_utm_term TEXT,
  p_fbclid TEXT,
  p_landing_url TEXT,
  p_referrer_url TEXT
)
RETURNS TABLE (out_contact_id UUID, out_assigned_member_id UUID, out_opportunity_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contact_id UUID;
  v_member_id UUID;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_opportunity_id UUID;
  v_custom_fields JSONB := '{}'::JSONB;
  v_full_name TEXT := BTRIM(p_first_name || ' ' || p_last_name);
  v_now TIMESTAMPTZ := NOW();
BEGIN
  PERFORM 1
  FROM public.tenants AS tenant
  WHERE tenant.id = p_tenant_id
    AND tenant.public_webhook_token = p_public_webhook_token
    AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_tenant_webhook_token' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_custom_fields) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'custom_fields_must_be_an_object' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_object_agg(item.key, item.value), '{}'::JSONB)
  INTO v_custom_fields
  FROM jsonb_each_text(p_custom_fields) AS item(key, value)
  JOIN public.custom_field_definitions AS definition
    ON definition.tenant_id = p_tenant_id
   AND definition.field_key = item.key;

  SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
  FROM public.contacts AS contact
  WHERE contact.tenant_id = p_tenant_id AND contact.phone_e164 = p_phone_e164;
  IF v_contact_id IS NULL THEN
    v_member_id := public.assign_round_robin_member(p_tenant_id);
  END IF;

  INSERT INTO public.contacts (
    tenant_id, assigned_member_id, full_name, phone_e164, email, custom_fields,
    lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, landing_url, referrer_url, last_interaction_at
  ) VALUES (
    p_tenant_id, v_member_id, v_full_name, p_phone_e164, p_email, v_custom_fields,
    COALESCE(NULLIF(BTRIM(p_lead_source), ''), NULLIF(BTRIM(p_utm_source), ''), 'Formulario Web'),
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_fbclid, p_landing_url, p_referrer_url, v_now
  )
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE SET
    assigned_member_id = COALESCE(contacts.assigned_member_id, EXCLUDED.assigned_member_id),
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, contacts.email),
    custom_fields = contacts.custom_fields || EXCLUDED.custom_fields,
    lead_source = COALESCE(EXCLUDED.lead_source, contacts.lead_source),
    utm_source = COALESCE(EXCLUDED.utm_source, contacts.utm_source),
    utm_medium = COALESCE(EXCLUDED.utm_medium, contacts.utm_medium),
    utm_campaign = COALESCE(EXCLUDED.utm_campaign, contacts.utm_campaign),
    utm_content = COALESCE(EXCLUDED.utm_content, contacts.utm_content),
    utm_term = COALESCE(EXCLUDED.utm_term, contacts.utm_term),
    fbclid = COALESCE(EXCLUDED.fbclid, contacts.fbclid),
    landing_url = COALESCE(EXCLUDED.landing_url, contacts.landing_url),
    referrer_url = COALESCE(EXCLUDED.referrer_url, contacts.referrer_url),
    last_interaction_at = v_now
  RETURNING id, assigned_member_id INTO v_contact_id, v_member_id;

  SELECT pipeline.id INTO v_pipeline_id
  FROM public.pipelines AS pipeline
  WHERE pipeline.tenant_id = p_tenant_id
  ORDER BY pipeline.is_default DESC, pipeline.created_at ASC, pipeline.id ASC
  LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    PERFORM public.ensure_tenant_workspace_defaults(p_tenant_id);
    SELECT pipeline.id INTO v_pipeline_id
    FROM public.pipelines AS pipeline
    WHERE pipeline.tenant_id = p_tenant_id
    ORDER BY pipeline.is_default DESC, pipeline.created_at ASC, pipeline.id ASC
    LIMIT 1;
  END IF;

  SELECT stage.id INTO v_stage_id
  FROM public.pipeline_stages AS stage
  WHERE stage.tenant_id = p_tenant_id
    AND stage.pipeline_id = v_pipeline_id
  ORDER BY
    CASE WHEN LOWER(BTRIM(stage.name)) = 'interesado' AND stage.stage_category = 'open' THEN 0 ELSE 1 END,
    CASE WHEN stage.stage_category = 'open' THEN 0 ELSE 1 END,
    stage.position ASC, stage.created_at ASC, stage.id ASC
  LIMIT 1;
  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'tenant_pipeline_stage_not_found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_contact_id::TEXT, 0));

  SELECT opportunity.id INTO v_opportunity_id
  FROM public.opportunities AS opportunity
  WHERE opportunity.tenant_id = p_tenant_id
    AND opportunity.contact_id = v_contact_id
    AND opportunity.pipeline_id = v_pipeline_id
    AND opportunity.status = 'open'
  ORDER BY opportunity.created_at DESC, opportunity.id DESC
  LIMIT 1;

  IF v_opportunity_id IS NULL THEN
    INSERT INTO public.opportunities (
      tenant_id, contact_id, pipeline_id, stage_id, assigned_member_id,
      title, monetary_value, status
    ) VALUES (
      p_tenant_id, v_contact_id, v_pipeline_id, v_stage_id, v_member_id,
      LEFT('Lead web - ' || v_full_name, 255), 0, 'open'
    ) RETURNING id INTO v_opportunity_id;
  END IF;

  INSERT INTO public.contact_activities (tenant_id, contact_id, activity_type, description, metadata)
  VALUES (
    p_tenant_id, v_contact_id, 'lead_web',
    'Lead web recibido; oportunidad inicial vinculada.',
    jsonb_strip_nulls(jsonb_build_object(
      'opportunity_id', v_opportunity_id, 'stage_id', v_stage_id,
      'utm_source', p_utm_source, 'utm_campaign', p_utm_campaign, 'fbclid', p_fbclid
    ))
  );

  RETURN QUERY SELECT v_contact_id, v_member_id, v_opportunity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_tenant_web_lead(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_tenant_web_lead(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Nombres públicos estables. Se conservan landings personalizadas con otro slug.
UPDATE public.tenant_landings AS landing
SET slug = replacement.new_slug
FROM (VALUES
  ('captacion-principal', 'captacion-hero'),
  ('formulario-minimo', 'captacion-minimal'),
  ('oferta-promocional', 'oferta-destacada')
) AS replacement(old_slug, new_slug)
WHERE landing.slug = replacement.old_slug
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_landings AS target
    WHERE target.tenant_id = landing.tenant_id AND target.slug = replacement.new_slug
  );

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

  INSERT INTO public.custom_field_definitions (tenant_id, field_key, field_label, field_type, options)
  SELECT p_tenant_id, field.key, field.label, field.kind, field.options
  FROM (VALUES
    ('operador_actual', 'Operador actual', 'select', '["Claro","Movistar","Tigo","WOM","ETB","Virgin Mobile"]'::jsonb),
    ('cedula', 'Cédula de ciudadanía', 'text', '[]'::jsonb),
    ('nip', 'NIP de portabilidad', 'text', '[]'::jsonb),
    ('direccion_envio_sim', 'Dirección de envío de la SIM', 'text', '[]'::jsonb),
    ('fecha_cita_llamada', 'Fecha de cita de llamada', 'date', '[]'::jsonb)
  ) AS field(key, label, kind, options)
  ON CONFLICT (tenant_id, field_key) DO NOTHING;

  INSERT INTO public.tenant_landings (tenant_id, slug, name, template_key, title, subtitle, cta_text)
  SELECT p_tenant_id, landing.slug, landing.name, landing.template_key,
         landing.title, landing.subtitle, landing.cta_text
  FROM (VALUES
    ('captacion-hero', 'Split Hero Conversión', 'hero_split', 'Conversemos sobre tu próxima oportunidad', 'Déjanos tus datos y un asesor te contactará.', 'Quiero más información'),
    ('captacion-minimal', 'Minimal Centrada', 'minimal_lead', 'Recibe información personalizada', 'Completa el formulario y te contactaremos.', 'Quiero que me contacten'),
    ('oferta-destacada', 'Oferta Promocional', 'promo_offer', 'Descubre nuestra promoción', 'Registra tus datos para conocer la oferta disponible.', 'Conocer la promoción')
  ) AS landing(slug, name, template_key, title, subtitle, cta_text)
  ON CONFLICT (tenant_id, slug) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_workspace_defaults(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_workspace_defaults(UUID) TO service_role;

DO $$
DECLARE
  workspace RECORD;
BEGIN
  FOR workspace IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_tenant_workspace_defaults(workspace.id);
  END LOOP;
END;
$$;
