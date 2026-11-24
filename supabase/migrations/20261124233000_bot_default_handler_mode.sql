-- ADlive CRM: las conversaciones de WhatsApp NUEVAS arrancan en modo «bot»
-- cuando el tenant tiene un bot activo con proveedor propio (no «integrated»),
-- para que el bot atienda automáticamente a quien escribe por primera vez.
-- Las conversaciones existentes conservan su modo: el asesor lo cambia desde
-- el selector «Modo de atención» del chat. Solo se modifica el INSERT de
-- conversations en ingest_whatsapp_messages (la variante for_tenant delega en ella).
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
      tenant_id, contact_id, assigned_member_id, channel, handler_mode, last_inbound_at, last_message_at
    ) VALUES (
      v_tenant_id, v_contact_id, v_member_id, 'whatsapp',
      CASE WHEN EXISTS (
        SELECT 1 FROM public.ai_bots AS bot
        WHERE bot.tenant_id = v_tenant_id
          AND bot.is_active = TRUE
          AND bot.provider <> 'integrated'
      ) THEN 'bot'::public.conversation_handler ELSE 'human'::public.conversation_handler END,
      v_occurred_at, v_occurred_at
    )
    ON CONFLICT (tenant_id, contact_id, channel) DO UPDATE SET
      assigned_member_id = COALESCE(conversations.assigned_member_id, EXCLUDED.assigned_member_id)
    RETURNING id INTO v_conversation_id;

    v_message_id := NULL;
    INSERT INTO public.messages (
      tenant_id, conversation_id, wa_message_id, direction, msg_type, body,
      media_id, media_mime_type, status, created_at
    ) VALUES (
      v_tenant_id, v_conversation_id, v_item ->> 'wa_message_id', 'inbound',
      (v_item ->> 'msg_type')::public.message_type, v_body,
      NULLIF(v_item ->> 'media_id', ''), v_item ->> 'media_mime_type', 'delivered', v_occurred_at
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
