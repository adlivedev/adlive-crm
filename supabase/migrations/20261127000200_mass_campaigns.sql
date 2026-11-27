-- QA-NEW-014 — Campañas masivas de WhatsApp por workspace.
-- Tablas campaigns (definición + estado) y campaign_sends (log por contacto),
-- con RLS multi-tenant igual que el resto del esquema.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  msg_type text not null check (msg_type in ('template', 'text', 'interactive')),
  template_name text,
  body text not null,
  interactive jsonb,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_tenant_status_idx on public.campaigns (tenant_id, status);

create table public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index campaign_sends_campaign_idx on public.campaign_sends (campaign_id, status);
create index campaign_sends_contact_idx on public.campaign_sends (contact_id);
create index campaign_sends_tenant_idx on public.campaign_sends (tenant_id, campaign_id);

alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;

/* Lectura: cualquier miembro activo del workspace (o superadmin de plataforma).
   Escritura: solo owner/admin del tenant (los envíos los hace el worker con
   service_role, que salta RLS). */
create policy campaigns_select on public.campaigns for select to authenticated
  using (private.current_member_id(tenant_id) is not null or is_platform_superadmin());
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy campaigns_update on public.campaigns for update to authenticated
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());

create policy campaign_sends_select on public.campaign_sends for select to authenticated
  using (private.current_member_id(tenant_id) is not null or is_platform_superadmin());
