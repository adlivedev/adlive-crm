-- FASE 1 (Iteración 20): historial de leads multi-canal, deduplicación de contactos,
-- columnas de medios/transcripción y mapeo de variables de plantillas.

-- 1) Teléfonos y correos adicionales por contacto ----------------------------

create table if not exists public.contact_phones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  phone_e164  text not null,
  is_primary  boolean not null default false,
  source      text,
  created_at  timestamptz not null default now()
);

create index if not exists contact_phones_tenant_contact_idx
  on public.contact_phones (tenant_id, contact_id);
create unique index if not exists contact_phones_unique_e164
  on public.contact_phones (tenant_id, phone_e164);

create table if not exists public.contact_emails (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  email       text not null,
  is_primary  boolean not null default false,
  source      text,
  created_at  timestamptz not null default now()
);

create index if not exists contact_emails_tenant_contact_idx
  on public.contact_emails (tenant_id, contact_id);
create unique index if not exists contact_emails_unique_email
  on public.contact_emails (tenant_id, lower(email));

-- 2) Historial de leads (origen de cada dato que conformó el contacto) -------

create table if not exists public.contact_lead_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  source      text not null,               -- 'form' | 'whatsapp' | 'manual' | 'merge' | 'import'
  detail      text,                        -- descripción legible para humanos
  payload     jsonb,                       -- datos crudos recibidos (UTM, campos del form, etc.)
  created_at  timestamptz not null default now()
);

create index if not exists contact_lead_history_tenant_contact_idx
  on public.contact_lead_history (tenant_id, contact_id, created_at desc);

-- 3) Columnas nuevas en mensajes / conversaciones / plantillas ---------------

alter table public.messages
  add column if not exists audio_transcript       text,
  add column if not exists audio_summary          text,
  add column if not exists audio_moderation_flag  boolean,
  add column if not exists media_deleted_at       timestamptz;

alter table public.conversations
  add column if not exists target_phone_e164      text;

alter table public.whatsapp_templates
  add column if not exists variable_mappings      jsonb,   -- [{"slot":"{{1}}","crmField":"full_name",...}]
  add column if not exists default_header_media_url text;

-- 4) Unicidad de correo por tenant (deduplicación estilo HubSpot) ------------

create unique index if not exists contacts_unique_email_per_tenant
  on public.contacts (tenant_id, lower(email))
  where email is not null and btrim(email) <> '';

-- 5) RLS multi-tenant ---------------------------------------------------------

alter table public.contact_phones      enable row level security;
alter table public.contact_emails      enable row level security;
alter table public.contact_lead_history enable row level security;

create policy contact_phones_select on public.contact_phones for select
  using (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_phones_insert on public.contact_phones for insert
  with check (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_phones_delete on public.contact_phones for delete
  using (private.is_tenant_admin(
    (select c.tenant_id from public.contacts c where c.id = contact_id)));
create policy contact_phones_superadmin on public.contact_phones for select
  using (is_platform_superadmin());

create policy contact_emails_select on public.contact_emails for select
  using (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_emails_insert on public.contact_emails for insert
  with check (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_emails_delete on public.contact_emails for delete
  using (private.is_tenant_admin(
    (select c.tenant_id from public.contacts c where c.id = contact_id)));
create policy contact_emails_superadmin on public.contact_emails for select
  using (is_platform_superadmin());

create policy contact_lead_history_select on public.contact_lead_history for select
  using (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_lead_history_insert on public.contact_lead_history for insert
  with check (private.can_view_assigned(
    (select c.tenant_id from public.contacts c where c.id = contact_id),
    (select c.assigned_member_id from public.contacts c where c.id = contact_id)));
create policy contact_lead_history_superadmin on public.contact_lead_history for select
  using (is_platform_superadmin());
