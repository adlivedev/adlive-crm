-- FASE 1 (Iteración 20): columnas descriptivas del historial de leads
-- (fuente del formulario, datos enviados y atribución UTM en columnas propias).

alter table public.contact_lead_history
  add column if not exists form_name       varchar(150),
  add column if not exists submitted_phone varchar(30),
  add column if not exists submitted_email varchar(255),
  add column if not exists utm_source      varchar(150),
  add column if not exists utm_medium      varchar(150),
  add column if not exists utm_campaign    varchar(255),
  add column if not exists utm_term        varchar(255);
