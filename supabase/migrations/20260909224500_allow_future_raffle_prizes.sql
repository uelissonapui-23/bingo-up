-- Drawn prizes are immutable, but organizers may append future prizes.
create or replace function public.configure_raffle_prizes(target_event_id uuid,target_prizes jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; item jsonb; pos integer:=0; prize_name text; drawn_count integer;
begin
  select * into e from public.events where id=target_event_id for update;
  if e.id is null or e.game_mode<>'raffle' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if jsonb_typeof(target_prizes)<>'array' or jsonb_array_length(target_prizes) not between 1 and 100 then raise exception 'invalid raffle prizes'; end if;
  select count(*) into drawn_count from public.raffle_draws where event_id=e.id;
  if jsonb_array_length(target_prizes)<drawn_count then raise exception 'cannot remove drawn prizes'; end if;
  delete from public.raffle_prizes p where p.event_id=e.id and p.position>jsonb_array_length(target_prizes) and not exists(select 1 from public.raffle_draws d where d.prize_id=p.id);
  for item in select value from jsonb_array_elements(target_prizes) loop
    pos:=pos+1; prize_name:=trim(coalesce(item->>'name',''));
    if char_length(prize_name) not between 1 and 160 then raise exception 'invalid prize name'; end if;
    if exists(select 1 from public.raffle_draws d join public.raffle_prizes p on p.id=d.prize_id where p.event_id=e.id and p.position=pos) then continue; end if;
    insert into public.raffle_prizes(workspace_id,event_id,position,name,description) values(e.workspace_id,e.id,pos,prize_name,nullif(left(trim(coalesce(item->>'description','')),500),''))
    on conflict(event_id,position) do update set name=excluded.name,description=excluded.description,updated_at=now();
  end loop;
  update public.raffle_configs set prize_description=(select string_agg(name,'; ' order by position) from public.raffle_prizes where event_id=e.id),updated_at=now() where event_id=e.id;
  perform public.log_special_game_audit(e.id,'raffle.prizes_configured','event',e.id::text,jsonb_build_object('count',pos,'drawn_immutable',drawn_count));
end $$;
revoke all on function public.configure_raffle_prizes(uuid,jsonb) from public,anon;
grant execute on function public.configure_raffle_prizes(uuid,jsonb) to authenticated;
