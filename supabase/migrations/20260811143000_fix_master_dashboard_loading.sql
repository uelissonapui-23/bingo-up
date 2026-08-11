-- Corrige o carregamento do painel Master.
-- O e-mail em auth.users e varchar; a RPC declara owner_email como text.
-- O cast explicito evita "structure of query does not match function result type".

create or replace function public.list_master_workspaces()
returns table(
  workspace_id uuid,
  name text,
  slug text,
  owner_user_id uuid,
  owner_email text,
  is_active boolean,
  access_status text,
  event_limit integer,
  valid_until timestamptz,
  notes text,
  events_total bigint,
  events_active bigint,
  members_total bigint,
  cards_sold bigint,
  sales_amount numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'master access denied';
  end if;

  return query
  select
    w.id,
    w.name,
    w.slug,
    w.owner_user_id,
    u.email::text,
    w.is_active,
    l.access_status::text,
    l.event_limit,
    l.valid_until,
    l.notes,
    (select count(*) from public.events e where e.workspace_id=w.id),
    (select count(*) from public.events e where e.workspace_id=w.id and e.status not in ('finished','canceled','archived')),
    (select count(*) from public.workspace_members wm where wm.workspace_id=w.id and wm.status='active'),
    (select count(*) from public.physical_cards c where c.workspace_id=w.id and c.status='sold'),
    coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=w.id and s.status='completed'),0)::numeric
  from public.workspaces w
  left join public.workspace_licenses l on l.workspace_id=w.id
  left join auth.users u on u.id=w.owner_user_id
  order by w.created_at desc;
end;
$$;

revoke all on function public.list_master_workspaces() from public;
grant execute on function public.list_master_workspaces() to authenticated;

-- Garante licenca para workspaces antigos que eventualmente nao tenham recebido o backfill.
insert into public.workspace_licenses(workspace_id,access_status,event_limit)
select id,'active',null
from public.workspaces
on conflict(workspace_id) do nothing;
