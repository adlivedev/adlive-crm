-- ADlive CRM: ingesta transaccional e idempotente exclusiva para Service Role.
CREATE OR REPLACE FUNCTION public.assign_round_robin_member(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  SELECT member.id INTO v_member_id
  FROM public.tenant_members AS member
  WHERE member.tenant_id = p_tenant_id
    AND member.is_active = TRUE
    AND member.role = 'agent'
  ORDER BY member.last_assigned_at ASC NULLS FIRST, member.created_at ASC, member.id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    UPDATE public.tenant_members
    SET last_assigned_at = NOW()
    WHERE id = v_member_id;
  END IF;
  RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_web_lead(
  p_public_webhook_token TEXT,
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
  p_referrer_url TEXT
)
RETURNS TABLE (out_contact_id UUID, out_assigned_member_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_contact_id UUID;
  v_member_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT tenant.id INTO v_tenant_id
  FROM public.tenants AS tenant
  WHERE tenant.public_webhook_token = p_public_webhook_token;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_webhook_token' USING ERRCODE = '42501';
  END IF;

  SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_member_id
  FROM public.contacts AS contact
  WHERE contact.tenant_id = v_tenant_id AND contact.phone_e164 = p_phone_e164;
  IF v_contact_id IS NULL THEN
    v_member_id := public.assign_round_robin_member(v_tenant_id);
  END IF;

  INSERT INTO public.contacts (
    tenant_id, assigned_member_id, full_name, phone_e164, email, company_name,
    lead_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, landing_url, referrer_url, last_interaction_at
  ) VALUES (
    v_tenant_id, v_member_id, p_full_name, p_phone_e164, p_email, p_company_name,
    COALESCE(p_lead_source, 'Formulario web'), p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_content, p_utm_term, p_fbclid, p_landing_url,
    p_referrer_url, v_now
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
    v_tenant_id, v_contact_id, 'lead_web',
    'Lead web recibido con atribución de campaña.',
    jsonb_strip_nulls(jsonb_build_object(
      'utm_source', p_utm_source, 'utm_medium', p_utm_medium,
      'utm_campaign', p_utm_campaign, 'utm_content', p_utm_content,
      'utm_term', p_utm_term, 'fbclid', p_fbclid
    ))
  );

  RETURN QUERY SELECT v_contact_id, v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_whatsapp_messages(
  p_phone_number_id TEXT,
  p_messages JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_item JSONB;
  v_contact_id UUID;
  v_contact_member_id UUID;
  v_conversation_id UUID;
  v_conversation_member_id UUID;
  v_member_id UUID;
  v_message_id UUID;
  v_body TEXT;
  v_occurred_at TIMESTAMPTZ;
  v_inserted_count INTEGER := 0;
BEGIN
  IF jsonb_typeof(p_messages) <> 'array' OR jsonb_array_length(p_messages) = 0 THEN
    RETURN 0;
  END IF;

  SELECT vault.tenant_id INTO v_tenant_id
  FROM public.tenant_integrations_vault AS vault
  WHERE vault.provider = 'whatsapp_cloud_api'
    AND vault.is_connected = TRUE
    AND vault.public_metadata ->> 'phone_number_id' = p_phone_number_id
  ORDER BY vault.updated_at DESC
  LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_integration_not_found' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_messages)
  LOOP
    IF EXISTS (SELECT 1 FROM public.messages WHERE wa_message_id = v_item ->> 'wa_message_id') THEN
      CONTINUE;
    END IF;

    v_occurred_at := COALESCE((v_item ->> 'occurred_at')::TIMESTAMPTZ, NOW());
    v_body := v_item ->> 'body';

    SELECT contact.id, contact.assigned_member_id INTO v_contact_id, v_contact_member_id
    FROM public.contacts AS contact
    WHERE contact.tenant_id = v_tenant_id
      AND contact.phone_e164 = v_item ->> 'phone_e164';

    IF v_contact_id IS NULL THEN
      v_contact_member_id := public.assign_round_robin_member(v_tenant_id);
      INSERT INTO public.contacts (
        tenant_id, assigned_member_id, full_name, phone_e164, lead_source, last_interaction_at
      ) VALUES (
        v_tenant_id, v_contact_member_id, v_item ->> 'full_name',
        v_item ->> 'phone_e164', 'WhatsApp', v_occurred_at
      )
      RETURNING id INTO v_contact_id;
    ELSE
      UPDATE public.contacts
      SET full_name = COALESCE(NULLIF(v_item ->> 'full_name', ''), contacts.full_name),
          last_interaction_at = GREATEST(COALESCE(contacts.last_interaction_at, v_occurred_at), v_occurred_at)
      WHERE id = v_contact_id;
    END IF;

    SELECT conversation.id, conversation.assigned_member_id
    INTO v_conversation_id, v_conversation_member_id
    FROM public.conversations AS conversation
    WHERE conversation.tenant_id = v_tenant_id
      AND conversation.contact_id = v_contact_id
      AND conversation.channel = 'whatsapp';

    v_member_id := COALESCE(v_conversation_member_id, v_contact_member_id);
    IF v_member_id IS NULL THEN
      v_member_id := public.assign_round_robin_member(v_tenant_id);
    END IF;

    UPDATE public.contacts
    SET assigned_member_id = v_member_id
    WHERE id = v_contact_id AND assigned_member_id IS NULL;

    INSERT INTO public.conversations (
      tenant_id, contact_id, assigned_member_id, channel, last_inbound_at, last_message_at
    ) VALUES (
      v_tenant_id, v_contact_id, v_member_id, 'whatsapp', v_occurred_at, v_occurred_at
    )
    ON CONFLICT (tenant_id, contact_id, channel) DO UPDATE SET
      assigned_member_id = COALESCE(conversations.assigned_member_id, EXCLUDED.assigned_member_id)
    RETURNING id INTO v_conversation_id;

    v_message_id := NULL;
    INSERT INTO public.messages (
      tenant_id, conversation_id, wa_message_id, direction, msg_type, body,
      media_mime_type, status, created_at
    ) VALUES (
      v_tenant_id, v_conversation_id, v_item ->> 'wa_message_id', 'inbound',
      (v_item ->> 'msg_type')::public.message_type, v_body,
      v_item ->> 'media_mime_type', 'delivered', v_occurred_at
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.conversations
    SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, v_occurred_at), v_occurred_at),
        last_message_at = GREATEST(last_message_at, v_occurred_at),
        last_message_preview = CASE
          WHEN v_occurred_at >= last_message_at THEN LEFT(COALESCE(v_body, ''), 120)
          ELSE last_message_preview
        END,
        last_message_media_type = CASE
          WHEN v_occurred_at >= last_message_at THEN (v_item ->> 'msg_type')::public.message_type
          ELSE last_message_media_type
        END,
        needs_reply = TRUE,
        unread_count = unread_count + 1
    WHERE id = v_conversation_id;

    IF LOWER(BTRIM(COALESCE(v_body, ''))) IN ('no', 'no.', 'no!') THEN
      UPDATE public.contacts
      SET opt_out_marketing = TRUE, typification = 'Cliente perdido'
      WHERE id = v_contact_id;
      UPDATE public.opportunities AS opportunity
      SET status = 'lost', closed_at = NOW(),
          stage_id = COALESCE((
            SELECT stage.id FROM public.pipeline_stages AS stage
            WHERE stage.tenant_id = v_tenant_id AND stage.stage_category = 'lost'
            ORDER BY stage.position DESC LIMIT 1
          ), opportunity.stage_id)
      WHERE opportunity.tenant_id = v_tenant_id
        AND opportunity.contact_id = v_contact_id
        AND opportunity.status = 'open';
    END IF;

    v_inserted_count := v_inserted_count + 1;
  END LOOP;
  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_round_robin_member(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_web_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_whatsapp_messages(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_round_robin_member(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_web_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_whatsapp_messages(TEXT, JSONB) TO service_role;
