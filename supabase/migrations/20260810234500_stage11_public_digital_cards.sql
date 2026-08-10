-- Etapa 11: cartela digital pública segura por token impresso.
-- Apenas cartelas efetivamente vendidas podem ser abertas publicamente.

create or replace function public.get_public_digital_card(card_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.physical_cards%rowtype;
  e public.events%rowtype;
  r public.bingo_rule_sets%rowtype;
  b public.card_batches%rowtype;
  t public.card_templates%rowtype;
  s public.draw_sessions%rowtype;
  called integer[] := '{}';
  games jsonb := '[]'::jsonb;
  winners_count integer := 0;
begin
  select * into c from public.physical_cards where public_token=card_token limit 1;
  if c.id is null or c.status <> 'sold' then
    return jsonb_build_object('available',false,'reason','not_sold');
  end if;

  select * into e from public.events where id=c.event_id;
  select * into r from public.bingo_rule_sets where id=c.rule_set_id;
  select * into b from public.card_batches where id=c.batch_id;
  select * into t from public.card_templates where id=c.template_id;

  select * into s from public.draw_sessions
  where event_id=c.event_id
  order by case when status in ('active','paused') then 0 else 1 end, session_number desc
  limit 1;

  if s.id is not null then
    select coalesce(array_agg(dn.number order by dn.sequence_number),'{}'::integer[])
      into called
      from public.draw_numbers dn
      where dn.session_id=s.id and dn.status='called';

    select count(*) into winners_count
      from public.winners w
      where w.session_id=s.id and w.physical_card_id=c.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',cg.position,
    'numbers',gd.numbers,
    'cells',gd.cells
  ) order by cg.position),'[]'::jsonb)
  into games
  from public.card_games cg
  join public.game_definitions gd on gd.id=cg.game_definition_id
  where cg.physical_card_id=c.id;

  return jsonb_build_object(
    'available',true,
    'event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status),
    'card',jsonb_build_object(
      'id',c.id,'code',c.code,'sequence_number',c.sequence_number,
      'physical_format',c.physical_format,'status',c.status,
      'series_code',b.series_code,'layout_key',t.layout_key
    ),
    'rule',jsonb_build_object(
      'grid_columns',r.grid_columns,
      'grid_rows',r.grid_rows,
      'column_definitions',r.column_definitions,
      'has_free_center',r.has_free_center
    ),
    'games',games,
    'draw',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'session_number',s.session_number,'name',s.name,'status',s.status,
      'win_pattern_code',s.win_pattern_code,'called_count',s.called_count,
      'last_called_number',s.last_called_number,'called_numbers',to_jsonb(called),
      'is_winner',winners_count>0
    ) end,
    'updated_at',now()
  );
end;
$$;

revoke all on function public.get_public_digital_card(uuid) from public;
grant execute on function public.get_public_digital_card(uuid) to anon,authenticated;
