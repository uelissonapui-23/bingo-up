-- Exibe convites pendentes ao organizador para conferência do cadastro e das liberações.
create or replace function public.list_pending_seller_invitations(target_workspace_id uuid)
returns table(id uuid,email text,event_ids uuid[],token uuid,status text,created_at timestamptz,expires_at timestamptz)
language sql stable security definer set search_path=public as $$
  select i.id,i.email,coalesce(i.event_ids,'{}'::uuid[]),i.token,
    case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
    i.created_at,i.expires_at
  from public.seller_invitations i
  where i.workspace_id=target_workspace_id and i.status='pending'
    and public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[])
  order by i.created_at desc;
$$;
revoke all on function public.list_pending_seller_invitations(uuid) from public,anon;
grant execute on function public.list_pending_seller_invitations(uuid) to authenticated;
