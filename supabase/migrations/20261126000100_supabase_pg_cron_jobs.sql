-- ============================================================================
-- FASE 2 — Cron nativo en Supabase (pg_cron + pg_net + Vault)
-- Reemplaza la limitación de Vercel Hobby: el scheduler oficial ahora vive en
-- la base de datos y llama a /api/v1/cron/process-jobs cada 5 minutos.
-- SEGURIDAD: el CRON_SECRET jamás se escribe en el repo; vive en Supabase Vault
-- (secret 'crm_cron_secret') y en las variables de entorno de Vercel.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Función disparadora: lee el secreto y la URL desde Vault y llama al endpoint
-- del CRM con la cabecera Authorization. Si el secreto aún no está cargado,
-- sale sin error (entornos locales/staging sin configurar).
create or replace function private.trigger_crm_process_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  select ds.decrypted_secret into secret
    from vault.decrypted_secrets ds
   where ds.name = 'crm_cron_secret'
   limit 1;

  select ds.decrypted_secret into url
    from vault.decrypted_secrets ds
   where ds.name = 'crm_cron_url'
   limit 1;

  url := coalesce(url, 'https://adlive-crm.vercel.app/api/v1/cron/process-jobs');

  if secret is null then
    raise notice 'crm_cron_secret no configurado en Vault; cron CRM omitido.';
    return;
  end if;

  perform net.http_get(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 10000
  );
end;
$$;

-- Programación idempotente: desprograma cualquier job previo con el mismo
-- nombre antes de reprogramarlo (evita duplicados al re-aplicar).
-- Notación posicional: los nombres de parámetros de cron.schedule/unschedule
-- varían según la versión de pg_cron de Supabase.
do $$
begin
  perform cron.unschedule('adlive-crm-process-jobs');
exception when others then
  -- No existe aún: nada que desprogramar.
  null;
end $$;

select cron.schedule('adlive-crm-process-jobs', '*/5 * * * *', 'select private.trigger_crm_process_jobs()');
