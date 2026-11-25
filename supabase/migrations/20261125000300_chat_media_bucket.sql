-- FASE 1 (Iteración 21): bucket público para imágenes enviadas por agentes
-- (límite 2 MB validado en la app). La carpeta raíz de cada objeto es el
-- tenant_id, lo que permite reutilizar el aislamiento multi-tenant de
-- private.can_view_assigned / private.is_tenant_admin en las policies.

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

create policy "chat_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
    and private.can_view_assigned(((storage.foldername(name))[1])::uuid, null));

create policy "chat_media_update" on storage.objects for update to authenticated
  using (bucket_id = 'chat-media'
    and private.can_view_assigned(((storage.foldername(name))[1])::uuid, null));

create policy "chat_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media'
    and (private.is_tenant_admin(((storage.foldername(name))[1])::uuid) or is_platform_superadmin()));
