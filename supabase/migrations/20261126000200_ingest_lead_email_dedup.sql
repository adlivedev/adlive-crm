-- ============================================================================
-- FIX P1 (QA Fase 3): deduplicación estilo HubSpot en la ingesta de leads.
--
-- La migración 20261125000100 creó contact_phones/contact_emails/contact_lead_history
-- y el índice único contacts_unique_email_per_tenant, pero la RPC
-- ingest_tenant_web_lead seguía siendo la versión anterior: deduplicaba solo
-- por teléfono, así que «mismo correo + teléfono nuevo» rompía el índice único
-- de correo y devolvía 500 en lugar de fusionar el lead.
--
-- Comportamiento nuevo:
--  1. Busca el contacto por teléfono (principal o adicionales en contact_phones).
--  2. Si no, lo busca por correo (case-insensitive, principal o adicionales en
--     contact_emails) y ENRIQUECE ese contacto en vez de crear uno nuevo.
--  3. Contacto nuevo: insert + teléfono/correo como primarios en las tablas
--     de identidad.
--  4. Contacto existente: nunca sobrescribe el correo principal ni el nombre;
--     agrega teléfono/correo adicionales como secundarios.
-- El historial (contact_lead_history) lo sigue registrando el servicio TS
-- consolidateLeadIdentity tras la ingesta.
-- ============================================================================

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
  v_has_email BOOLEAN := p_email IS NOT NULL AND BTRIM(p_email) <> '';
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

  /* 1) ¿Ya conocemos este teléfono? (principal o adicional) */
  SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
  FROM public.contacts AS contact
  WHERE contact.tenant_id = p_tenant_id AND contact.phone_e164 = p_phone_e164
  ORDER BY contact.created_at ASC
  LIMIT 1;
  IF v_contact_id IS NULL THEN
    SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
    FROM public.contacts AS contact
    JOIN public.contact_phones AS phone
      ON phone.tenant_id = contact.tenant_id AND phone.contact_id = contact.id
    WHERE contact.tenant_id = p_tenant_id AND phone.phone_e164 = p_phone_e164
    ORDER BY contact.created_at ASC
    LIMIT 1;
  END IF;

  /* 2) ¿Ya conocemos este correo? → enriquecer ese contacto, NUNCA duplicar */
  IF v_contact_id IS NULL AND v_has_email THEN
    SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
    FROM public.contacts AS contact
    WHERE contact.tenant_id = p_tenant_id AND LOWER(BTRIM(contact.email)) = LOWER(BTRIM(p_email))
    ORDER BY contact.created_at ASC
    LIMIT 1;
    IF v_contact_id IS NULL THEN
      SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
      FROM public.contacts AS contact
      JOIN public.contact_emails AS extra_email
        ON extra_email.tenant_id = contact.tenant_id AND extra_email.contact_id = contact.id
      WHERE contact.tenant_id = p_tenant_id AND LOWER(BTRIM(extra_email.email)) = LOWER(BTRIM(p_email))
      ORDER BY contact.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_contact_id IS NULL THEN
    v_member_id := public.assign_round_robin_member(p_tenant_id);
  END IF;

  IF v_contact_id IS NULL THEN
    /* 3a) Contacto nuevo */
    INSERT INTO public.contacts (
      tenant_id, assigned_member_id, full_name, phone_e164, email, custom_fields,
      lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, landing_url, referrer_url, last_interaction_at
    ) VALUES (
      p_tenant_id, v_member_id, v_full_name, p_phone_e164,
      CASE WHEN v_has_email THEN LOWER(BTRIM(p_email)) ELSE NULL END,
      v_custom_fields,
      COALESCE(NULLIF(BTRIM(p_lead_source), ''), NULLIF(BTRIM(p_utm_source), ''), 'Formulario Web'),
      p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
      p_fbclid, p_landing_url, p_referrer_url, v_now
    )
    RETURNING id, assigned_member_id INTO v_contact_id, v_member_id;

    INSERT INTO public.contact_phones (tenant_id, contact_id, phone_e164, is_primary, source)
    VALUES (p_tenant_id, v_contact_id, p_phone_e164, TRUE, 'form')
    ON CONFLICT DO NOTHING;
    IF v_has_email THEN
      INSERT INTO public.contact_emails (tenant_id, contact_id, email, is_primary, source)
      VALUES (p_tenant_id, v_contact_id, LOWER(BTRIM(p_email)), TRUE, 'form')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    /* 3b) Contacto existente: enriquecer sin sobrescribir identidad */
    UPDATE public.contacts AS contact
    SET assigned_member_id = COALESCE(contact.assigned_member_id, v_member_id),
        custom_fields = contact.custom_fields || v_custom_fields,
        lead_source = COALESCE(NULLIF(BTRIM(p_lead_source), ''), NULLIF(BTRIM(p_utm_source), ''), contact.lead_source),
        utm_source = COALESCE(p_utm_source, contact.utm_source),
        utm_medium = COALESCE(p_utm_medium, contact.utm_medium),
        utm_campaign = COALESCE(p_utm_campaign, contact.utm_campaign),
        utm_content = COALESCE(p_utm_content, contact.utm_content),
        utm_term = COALESCE(p_utm_term, contact.utm_term),
        fbclid = COALESCE(p_fbclid, contact.fbclid),
        landing_url = COALESCE(p_landing_url, contact.landing_url),
        referrer_url = COALESCE(p_referrer_url, contact.referrer_url),
        last_interaction_at = v_now
    WHERE contact.id = v_contact_id;
  END IF;

  /* Teléfono del lead como adicional (idempotente; el primario ya existe). */
  INSERT INTO public.contact_phones (tenant_id, contact_id, phone_e164, is_primary, source)
  VALUES (p_tenant_id, v_contact_id, p_phone_e164, FALSE, 'form')
  ON CONFLICT DO NOTHING;

  /* Correo del lead como adicional secundario; el dueño/admin puede promoverlo
     a principal desde la Ficha 360°. */
  IF v_has_email THEN
    INSERT INTO public.contact_emails (tenant_id, contact_id, email, is_primary, source)
    VALUES (p_tenant_id, v_contact_id, LOWER(BTRIM(p_email)), FALSE, 'form')
    ON CONFLICT DO NOTHING;
  END IF;

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
