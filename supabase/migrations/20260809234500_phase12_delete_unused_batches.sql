-- Fase 12.5: exclusão segura de lotes de teste/gerados por engano.
-- Só permite apagar lotes que ainda não tenham sido usados em vendas ou sorteios.

create or replace function public.delete_unused_card_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.card_batches%rowtype;
  deleted_cards integer := 0;
  deleted_games integer := 0;
  candidate_game_ids uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into b from public.card_batches where id=target_batch_id for update;
  if b.id is null then raise exception 'batch not found'; end if;
  if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'access denied';
  end if;
  if b.status='generating' then raise exception 'batch is still generating; cancel it first'; end if;

  if exists(
    select 1 from public.sale_items si
    join public.physical_cards pc on pc.id=si.physical_card_id
    where pc.batch_id=b.id
  ) then
    raise exception 'batch has cards linked to sale or reservation';
  end if;

  if exists(
    select 1 from public.draw_session_games dsg
    join public.physical_cards pc on pc.id=dsg.physical_card_id
    where pc.batch_id=b.id
  ) or exists(
    select 1 from public.game_progress gp
    join public.physical_cards pc on pc.id=gp.physical_card_id
    where pc.batch_id=b.id
  ) or exists(
    select 1 from public.winner_candidates wc
    join public.physical_cards pc on pc.id=wc.physical_card_id
    where pc.batch_id=b.id
  ) or exists(
    select 1 from public.winners w
    join public.physical_cards pc on pc.id=w.physical_card_id
    where pc.batch_id=b.id
  ) then
    raise exception 'batch has cards linked to draw or winner history';
  end if;

  select coalesce(array_agg(distinct cg.game_definition_id),'{}'::uuid[]) into candidate_game_ids
  from public.card_games cg where cg.batch_id=b.id;
  select count(*) into deleted_cards from public.physical_cards where batch_id=b.id;

  -- Apagar o lote remove por cascade as cartelas, jogos físicos e trabalhos de impressão.
  delete from public.card_batches where id=b.id;

  -- Limpa somente definições que ficaram realmente órfãs. Jogos reaproveitados por outros lotes permanecem.
  if cardinality(candidate_game_ids)>0 then
    delete from public.game_definitions gd
    where gd.id=any(candidate_game_ids)
      and not exists(select 1 from public.card_games cg where cg.game_definition_id=gd.id)
      and not exists(select 1 from public.draw_session_games dsg where dsg.game_definition_id=gd.id)
      and not exists(select 1 from public.game_progress gp where gp.game_definition_id=gd.id)
      and not exists(select 1 from public.winner_candidates wc where wc.game_definition_id=gd.id)
      and not exists(select 1 from public.winners w where w.game_definition_id=gd.id);
    get diagnostics deleted_games = row_count;
  end if;

  perform public.log_audit(
    b.workspace_id,
    'card_batch.deleted_unused',
    'card_batch',
    b.id::text,
    jsonb_build_object(
      'event_id',b.event_id,
      'series_code',b.series_code,
      'deleted_cards',deleted_cards,
      'deleted_orphan_games',deleted_games,
      'reason','Lote de teste ou geração feita por engano'
    )
  );

  return jsonb_build_object('deleted_cards',deleted_cards,'deleted_orphan_games',deleted_games);
end;
$$;

revoke all on function public.delete_unused_card_batch(uuid) from public;
grant execute on function public.delete_unused_card_batch(uuid) to authenticated;
