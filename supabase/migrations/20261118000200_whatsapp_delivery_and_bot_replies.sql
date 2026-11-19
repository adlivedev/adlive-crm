-- Vincula una respuesta automática con su mensaje entrante.
-- El índice único parcial hace idempotente la generación ante reintentos de Meta.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS in_reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_inbound_bot_reply
  ON public.messages(in_reply_to_message_id)
  WHERE in_reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_wa_status
  ON public.messages(tenant_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;

COMMENT ON COLUMN public.messages.in_reply_to_message_id IS
  'Mensaje entrante que originó esta respuesta; su unicidad evita respuestas automáticas duplicadas.';
