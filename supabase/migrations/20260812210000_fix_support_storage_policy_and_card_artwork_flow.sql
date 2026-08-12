-- Corrige interferência das policies do suporte em uploads de outros buckets.
-- A policy antiga consultava platform_support_threads diretamente. Como a tabela
-- é deliberadamente revogada para authenticated, o PostgreSQL podia avaliar essa
-- expressão também durante um upload no bucket card-artworks e retornar
-- "permission denied for table platform_support_threads".
--
-- A verificação de propriedade passa a ser feita por uma função SECURITY DEFINER,
-- mantendo a tabela privada e impedindo que a policy do suporte quebre o editor de cartelas.

create or replace function public.can_access_platform_support_thread(target_thread_id text, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_platform_owner()
    or exists(
      select 1
      from public.platform_support_threads t
      where t.id::text=target_thread_id
        and t.user_id=target_user_id
    );
$$;

revoke all on function public.can_access_platform_support_thread(text,uuid) from public;
grant execute on function public.can_access_platform_support_thread(text,uuid) to authenticated;

drop policy if exists platform_support_upload on storage.objects;
create policy platform_support_upload on storage.objects
for insert to authenticated
with check(
  bucket_id='platform-support'
  and (
    public.is_platform_owner()
    or (
      (storage.foldername(name))[1]=auth.uid()::text
      and nullif((storage.foldername(name))[2],'') is not null
      and public.can_access_platform_support_thread((storage.foldername(name))[2],auth.uid())
    )
  )
);

drop policy if exists platform_support_read on storage.objects;
create policy platform_support_read on storage.objects
for select to authenticated
using(
  bucket_id='platform-support'
  and (
    public.is_platform_owner()
    or (
      (storage.foldername(name))[1]=auth.uid()::text
      and nullif((storage.foldername(name))[2],'') is not null
      and public.can_access_platform_support_thread((storage.foldername(name))[2],auth.uid())
    )
  )
);

-- DELETE continua exclusivo do Master e não consulta a tabela de threads.
drop policy if exists platform_support_delete on storage.objects;
create policy platform_support_delete on storage.objects
for delete to authenticated
using(bucket_id='platform-support' and public.is_platform_owner());
