-- Winner registry + prize delivery tracking for organizer/operator.
create table if not exists public.winner_prize_deliveries (
  winner_id uuid primary key references public.winners(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  delivered boolean not null default false,
  delivered_at timestamptz,
  delivered_by uuid references auth.users(id) on delete set null,
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists winner_prize_deliveries_event_idx on public.winner_prize_deliveries(event_id,delivered,updated_at desc);
alter table public.winner_prize_deliveries enable row level security;

drop policy if exists winner_prize_deliveries_read on public.winner_prize_deliveries;
create policy winner_prize_deliveries_read on public.winner_prize_deliveries for select to authenticated using(
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.draw_operator_has_event_access(event_id)
);

create or replace function public.get_event_winner_registry(target_event_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; allowed boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  allowed := public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
    or public.draw_operator_has_event_access(e.id);
  if not allowed then raise exception 'access denied'; end if;

  return jsonb_build_object(
    'event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status),
    'winners',coalesce((
      select jsonb_agg(jsonb_build_object(
        'winner_id',w.id,
        'session_id',w.session_id,
        'session_number',ds.session_number,
        'round_name',coalesce(nullif(trim(ds.name),''),'Rodada '||ds.session_number),
        'prize_name',coalesce(nullif(ds.win_pattern_snapshot->>'name',''),ds.win_pattern_code),
        'confirmed_at',w.confirmed_at,
        'confirmation_note',w.confirmation_note,
        'card_id',pc.id,
        'card_code',pc.code,
        'card_public_token',pc.public_token,
        'game_position',cg.position,
        'buyer_name',sale.buyer_name,
        'buyer_phone',sale.buyer_phone,
        'buyer_email',sale.buyer_email,
        'buyer_notes',sale.buyer_notes,
        'delivered',coalesce(pd.delivered,false),
        'delivered_at',pd.delivered_at,
        'delivery_note',pd.note
      ) order by ds.session_number desc,w.confirmed_at desc)
      from public.winners w
      join public.draw_sessions ds on ds.id=w.session_id
      join public.physical_cards pc on pc.id=w.physical_card_id
      join public.card_games cg on cg.id=w.card_game_id
      left join lateral (
        select s.buyer_name,s.buyer_phone,s.buyer_email,s.buyer_notes
        from public.sale_items si join public.sales s on s.id=si.sale_id
        where si.physical_card_id=w.physical_card_id and si.status='active' and s.status='completed'
        order by s.completed_at desc nulls last,s.created_at desc limit 1
      ) sale on true
      left join public.winner_prize_deliveries pd on pd.winner_id=w.id
      where w.event_id=e.id
    ),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_event_winner_registry(uuid) from public;
grant execute on function public.get_event_winner_registry(uuid) to authenticated;

create or replace function public.set_winner_prize_delivery(target_winner_id uuid,target_delivered boolean,target_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare w public.winners%rowtype; e public.events%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into w from public.winners where id=target_winner_id;
  if w.id is null then raise exception 'winner not found'; end if;
  select * into e from public.events where id=w.event_id;
  if not public.has_workspace_role(w.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
    and not public.draw_operator_has_event_access(w.event_id) then raise exception 'access denied'; end if;

  insert into public.winner_prize_deliveries(winner_id,workspace_id,event_id,delivered,delivered_at,delivered_by,note,updated_at)
  values(w.id,w.workspace_id,w.event_id,target_delivered,case when target_delivered then now() else null end,case when target_delivered then auth.uid() else null end,left(nullif(trim(target_note),''),1000),now())
  on conflict(winner_id) do update set
    delivered=excluded.delivered,
    delivered_at=excluded.delivered_at,
    delivered_by=excluded.delivered_by,
    note=coalesce(excluded.note,public.winner_prize_deliveries.note),
    updated_at=now();

  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(w.workspace_id,auth.uid(),case when target_delivered then 'winner.prize_delivered' else 'winner.prize_delivery_reopened' end,'winner',w.id::text,jsonb_build_object('event_id',w.event_id,'note',left(nullif(trim(target_note),''),1000)));
end $$;
revoke all on function public.set_winner_prize_delivery(uuid,boolean,text) from public;
grant execute on function public.set_winner_prize_delivery(uuid,boolean,text) to authenticated;
