-- ADlive CRM: reparar cuerpos de funciones envolvente tras el traslado de esquema.
-- La migración 20261113000500_security_hardening movió las funciones de public a private,
-- pero los cuerpos de can_access_contact y can_access_conversation seguían llamando a
-- public.can_view_assigned (ya inexistente), lo que provocaba:
--   "function public.can_view_assigned(uuid,uuid) does not exist"
-- al cargar el dashboard y las conversaciones.
CREATE OR REPLACE FUNCTION private.can_access_contact(p_tenant_id UUID, p_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contacts AS contact
    WHERE contact.tenant_id = p_tenant_id
      AND contact.id = p_contact_id
      AND private.can_view_assigned(contact.tenant_id, contact.assigned_member_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_conversation(p_tenant_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations AS conversation
    WHERE conversation.tenant_id = p_tenant_id
      AND conversation.id = p_conversation_id
      AND private.can_view_assigned(conversation.tenant_id, conversation.assigned_member_id)
  );
$$;
