-- FASE 2 (Iteración 22): bots IA avanzados, constructor de formularios,
-- notificaciones por rol y cola anti-timeout.

-- 1) Bots IA -----------------------------------------------------------------

alter table public.ai_bots
  add column if not exists model_name       varchar(100),
  add column if not exists fallback_models  text[] not null default '{}',
  add column if not exists priority         int not null default 10,
  add column if not exists bot_role         varchar(50) not null default 'custom',
  add column if not exists trigger_keywords text[] not null default '{}';

alter table public.tenants
  add column if not exists default_new_contact_mode varchar(20) not null default 'human',
  add column if not exists default_bot_id uuid references public.ai_bots(id) on delete set null;

create table if not exists public.ai_usage_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  bot_id            uuid references public.ai_bots(id) on delete set null,
  provider          varchar(50) not null,
  model_name        varchar(100),
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  total_tokens      int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  status            varchar(30) not null,
  latency_ms        int,
  error_code        varchar(100),
  created_at        timestamptz not null default now()
);
create index if not exists ai_usage_logs_tenant_created_idx
  on public.ai_usage_logs (tenant_id, created_at desc);

-- 2) Constructor de formularios y landings -----------------------------------

create table if not exists public.tenant_forms (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  slug         varchar(120) not null,
  name         varchar(150) not null,
  description  text,
  columns      int not null default 1,
  is_multistep boolean not null default false,
  steps        jsonb not null default '[]',
  fields       jsonb not null default '[]',
  html_blocks  jsonb not null default '[]',
  theme_config jsonb not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table public.tenant_landings
  add column if not exists form_id           uuid references public.tenant_forms(id) on delete set null,
  add column if not exists font_family       varchar(80) not null default 'Inter',
  add column if not exists sections_config   jsonb not null default '{}';

-- 3) Notificaciones por rol --------------------------------------------------

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  recipient_member_id uuid references public.tenant_members(id) on delete cascade,
  target_role         varchar(30),
  type                varchar(60) not null,
  title               varchar(180) not null,
  body                text not null,
  action_url          varchar(255) not null,
  metadata            jsonb not null default '{}',
  is_read             boolean not null default false,
  email_sent          boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists notifications_tenant_recipient_idx
  on public.notifications (tenant_id, recipient_member_id, created_at desc);
create index if not exists notifications_tenant_role_idx
  on public.notifications (tenant_id, target_role, created_at desc);

alter publication supabase_realtime add table public.notifications;

-- 4) Cola anti-timeout --------------------------------------------------------

create table if not exists public.background_jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  job_type     varchar(80) not null,
  payload      jsonb not null,
  status       varchar(30) not null default 'pending',
  attempts     int not null default 0,
  max_attempts int not null default 3,
  run_after    timestamptz not null default now(),
  last_error   text,
  locked_at    timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists background_jobs_pending_idx
  on public.background_jobs (status, run_after) where status = 'pending';

-- 5) RLS ---------------------------------------------------------------------

alter table public.ai_usage_logs   enable row level security;
alter table public.tenant_forms    enable row level security;
alter table public.notifications   enable row level security;
alter table public.background_jobs enable row level security;

create policy ai_usage_logs_select on public.ai_usage_logs for select
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy ai_usage_logs_insert on public.ai_usage_logs for insert
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin());

create policy tenant_forms_select on public.tenant_forms for select
  using (private.can_view_assigned(tenant_id, null));
create policy tenant_forms_insert on public.tenant_forms for insert
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy tenant_forms_update on public.tenant_forms for update
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin())
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy tenant_forms_delete on public.tenant_forms for delete
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());

create policy notifications_select on public.notifications for select
  using (recipient_member_id = private.current_member_id(tenant_id)
         or private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy notifications_insert on public.notifications for insert
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin()
              or recipient_member_id = private.current_member_id(tenant_id));
create policy notifications_update on public.notifications for update
  using (recipient_member_id = private.current_member_id(tenant_id)
         or private.is_tenant_admin(tenant_id) or is_platform_superadmin());

create policy background_jobs_select on public.background_jobs for select
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy background_jobs_insert on public.background_jobs for insert
  with check (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy background_jobs_update on public.background_jobs for update
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
create policy background_jobs_delete on public.background_jobs for delete
  using (private.is_tenant_admin(tenant_id) or is_platform_superadmin());
