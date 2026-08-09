-- Fase 12+: artes de cartelas otimizadas e coringas personalizados.
-- Os arquivos ficam no Storage; card_templates.options guarda somente caminho e transformações.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('card-artworks','card-artworks',true,10485760,array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/webp','image/png','image/jpeg'];

drop policy if exists card_artworks_insert on storage.objects;
create policy card_artworks_insert on storage.objects
for insert to authenticated with check (
  bucket_id='card-artworks'
  and array_length(storage.foldername(name),1)>=2
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
);

drop policy if exists card_artworks_update on storage.objects;
create policy card_artworks_update on storage.objects
for update to authenticated using (
  bucket_id='card-artworks'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
) with check (
  bucket_id='card-artworks'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
);

drop policy if exists card_artworks_delete on storage.objects;
create policy card_artworks_delete on storage.objects
for delete to authenticated using (
  bucket_id='card-artworks'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['organizer_owner','organizer_admin']::public.workspace_role[])
);
