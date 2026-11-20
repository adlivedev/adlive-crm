-- ADlive CRM: credenciales y webhooks aislados por empresa.
-- Conserva la ingesta legacy; las nuevas funciones exigen tenant y proveedor explícitos.

CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_unique_connected_whatsapp_phone
ON public.tenant_integrations_vault ((public_metadata ->> 'phone_number_id'))
WHERE provider = 'whatsapp_cloud_api' AND is_connected = TRUE;

CREATE OR REPLACE FUNCTION public.ingest_whatsapp_messages_for_tenant(
  p_tenant_id UUID,
  p_phone_number_id TEXT,
  p_messages JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_inserted_count INTEGER;
BEGIN
  IF jsonb_typeof(p_messages) <> 'array' OR jsonb_array_length(p_messages) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM 1
  FROM public.tenant_integrations_vault AS vault
  WHERE vault.tenant_id = p_tenant_id
    AND vault.provider = 'whatsapp_cloud_api'
    AND vault.is_connected = TRUE
    AND vault.public_metadata ->> 'phone_number_id' = p_phone_number_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_tenant_integration_mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_inserted_count := public.ingest_whatsapp_messages(p_phone_number_id, p_messages);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_messages)
  LOOP
    IF NULLIF(v_item ->> 'lead_source', '') IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE public.contacts
    SET lead_source = COALESCE(NULLIF(v_item ->> 'lead_source', ''), contacts.lead_source),
        utm_source = COALESCE(NULLIF(v_item ->> 'utm_source', ''), contacts.utm_source),
        utm_medium = COALESCE(NULLIF(v_item ->> 'utm_medium', ''), contacts.utm_medium),
        utm_campaign = COALESCE(NULLIF(v_item ->> 'utm_campaign', ''), contacts.utm_campaign),
        utm_term = COALESCE(NULLIF(v_item ->> 'utm_term', ''), contacts.utm_term),
        fbclid = COALESCE(NULLIF(v_item ->> 'fbclid', ''), contacts.fbclid),
        landing_url = COALESCE(NULLIF(v_item ->> 'landing_url', ''), contacts.landing_url),
        updated_at = NOW()
    WHERE contacts.tenant_id = p_tenant_id
      AND contacts.phone_e164 = v_item ->> 'phone_e164';
  END LOOP;

  RETURN v_inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_tenant_lead(
  p_tenant_id UUID,
  p_provider TEXT,
  p_event_id TEXT,
  p_full_name TEXT,
  p_phone_e164 TEXT,
  p_email TEXT,
  p_company_name TEXT,
  p_lead_source TEXT,
  p_utm_source TEXT,
  p_utm_medium TEXT,
  p_utm_campaign TEXT,
  p_utm_content TEXT,
  p_utm_term TEXT,
  p_fbclid TEXT,
  p_landing_url TEXT,
  p_referrer_url TEXT,
  p_message TEXT
)
RETURNS TABLE (out_contact_id UUID, out_assigned_member_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contact_id UUID;
  v_member_id UUID;
  v_conversation_id UUID;
  v_message_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  PERFORM 1
  FROM public.tenant_integrations_vault AS vault
  WHERE vault.tenant_id = p_tenant_id
    AND vault.provider = p_provider
    AND vault.is_connected = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant_provider_integration_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT activity.contact_id, contact.assigned_member_id
  INTO v_contact_id, v_member_id
  FROM public.contact_activities AS activity
  JOIN public.contacts AS contact ON contact.id = activity.contact_id
  WHERE activity.tenant_id = p_tenant_id
    AND activity.metadata ->> 'provider' = p_provider
    AND activity.metadata ->> 'event_id' = p_event_id
  LIMIT 1;
  IF v_contact_id IS NOT NULL THEN
    RETURN QUERY SELECT v_contact_id, v_member_id;
    RETURN;
  END IF;

  SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
  FROM public.contacts AS contact
  WHERE contact.tenant_id = p_tenant_id AND contact.phone_e164 = p_phone_e164;
  IF v_contact_id IS NULL THEN
    v_member_id := public.assign_round_robin_member(p_tenant_id);
  END IF;

  INSERT INTO public.contacts (
    tenant_id, assigned_member_id, full_name, phone_e164, email, company_name,
    lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, landing_url, referrer_url, last_interaction_at
  ) VALUES (
    p_tenant_id, v_member_id, p_full_name, p_phone_e164, p_email, p_company_name,
    p_lead_source, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content,
    p_utm_term, p_fbclid, p_landing_url, p_referrer_url, v_now
  )
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE SET
    assigned_member_id = COALESCE(contacts.assigned_member_id, EXCLUDED.assigned_member_id),
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, contacts.email),
    company_name = COALESCE(EXCLUDED.company_name, contacts.company_name),
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

  INSERT INTO public.contact_activities (tenant_id, contact_id, activity_type, description, metadata)
  VALUES (
    p_tenant_id, v_contact_id, p_provider || '_webhook',
    'Lead o mensaje recibido por webhook aislado del proveedor.',
    jsonb_strip_nulls(jsonb_build_object(
      'provider', p_provider, 'event_id', p_event_id, 'utm_source', p_utm_source,
      'utm_campaign', p_utm_campaign, 'utm_term', p_utm_term, 'fbclid', p_fbclid
    ))
  );

  IF NULLIF(BTRIM(COALESCE(p_message, '')), '') IS NOT NULL THEN
    INSERT INTO public.conversations (
      tenant_id, contact_id, assigned_member_id, channel, last_inbound_at, last_message_at
    ) VALUES (p_tenant_id, v_contact_id, v_member_id, p_provider, v_now, v_now)
    ON CONFLICT (tenant_id, contact_id, channel) DO UPDATE SET
      assigned_member_id = COALESCE(conversations.assigned_member_id, EXCLUDED.assigned_member_id)
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.messages (
      tenant_id, conversation_id, wa_message_id, direction, msg_type, body, status, created_at
    ) VALUES (
      p_tenant_id, v_conversation_id, p_provider || ':' || p_event_id,
      'inbound', 'text', p_message, 'delivered', v_now
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      UPDATE public.conversations
      SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, v_now), v_now),
          last_message_at = GREATEST(last_message_at, v_now),
          last_message_preview = LEFT(p_message, 120),
          last_message_media_type = 'text', needs_reply = TRUE, unread_count = unread_count + 1
      WHERE id = v_conversation_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_contact_id, v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_whatsapp_messages_for_tenant(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_tenant_lead(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_whatsapp_messages_for_tenant(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_tenant_lead(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
