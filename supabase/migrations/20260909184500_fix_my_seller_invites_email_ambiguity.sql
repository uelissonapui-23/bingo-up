create or replace function public.list_my_pending_seller_invitations()
returns table(token uuid,workspace_name text,email text,event_names text[],expires_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare current_email text; confirmed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(u.email),u.email_confirmed_at into current_email,confirmed_at from auth.users u where u.id=auth.uid();
  if current_email is null or confirmed_at is null then raise exception 'confirmed email required'; end if;
  return query select i.token,w.name,i.email,coalesce((select array_agg(e.name order by e.starts_at nulls last,e.name) from public.events e where e.id=any(i.event_ids)),'{}'::text[]),i.expires_at
    from public.seller_invitations i join public.workspaces w on w.id=i.workspace_id
    where lower(i.email)=current_email and i.status='pending' and i.expires_at>now() and w.is_active order by i.created_at desc;
end $$;
revoke all on function public.list_my_pending_seller_invitations() from public,anon;
grant execute on function public.list_my_pending_seller_invitations() to authenticated;
