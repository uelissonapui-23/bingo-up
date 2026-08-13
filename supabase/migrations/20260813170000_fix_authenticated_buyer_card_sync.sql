-- Corrige a cartela digital da Central do Comprador.
-- A área autenticada deixa de depender do endpoint público por token e usa uma RPC própria,
-- limitada à compra concluída do e-mail confirmado da conta logada.
create or replace function public.get_my_buyer_digital_card(target_event_id uuid,target_card_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  my_email text;
  email_confirmed timestamptz;
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
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email),email_confirmed_at into my_email,email_confirmed from auth.users where id=auth.uid();
  if my_email is null or email_confirmed is null then raise exception 'confirmed buyer email required'; end if;

  select pc.* into c
  from public.physical_cards pc
  join public.sale_items si on si.physical_card_id=pc.id and si.status='active'
  join public.sales sa on sa.id=si.sale_id and sa.status='completed'
  where pc.id=target_card_id
    and pc.event_id=target_event_id
    and pc.status='sold'
    and lower(trim(coalesce(sa.buyer_email,'')))=trim(my_email)
  limit 1;
  if c.id is null then raise exception 'buyer card access denied'; end if;

  select * into e from public.events where id=c.event_id;
  select * into r from public.bingo_rule_sets where id=c.rule_set_id;
  select * into b from public.card_batches where id=c.batch_id;
  select * into t from public.card_templates where id=c.template_id;

  select * into s from public.draw_sessions
  where event_id=c.event_id
  order by case when status in ('active','paused') then 0 else 1 end,session_number desc
  limit 1;
  if s.id is not null then
    select coalesce(array_agg(dn.number order by dn.sequence_number),'{}'::integer[]) into called
    from public.draw_numbers dn where dn.session_id=s.id and dn.status='called';
    select count(*) into winners_count from public.winners w where w.session_id=s.id and w.physical_card_id=c.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('position',cg.position,'numbers',gd.numbers,'cells',gd.cells) order by cg.position),'[]'::jsonb)
  into games
  from public.card_games cg join public.game_definitions gd on gd.id=cg.game_definition_id
  where cg.physical_card_id=c.id;

  return jsonb_build_object(
    'event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status),
    'card',jsonb_build_object('id',c.id,'code',c.code,'sequence_number',c.sequence_number,'physical_format',c.physical_format,'status',c.status,'series_code',b.series_code,'layout_key',t.layout_key),
    'rule',jsonb_build_object('grid_columns',r.grid_columns,'grid_rows',r.grid_rows,'column_definitions',r.column_definitions,'has_free_center',r.has_free_center),
    'games',games,
    'draw',case when s.id is null then null else jsonb_build_object('id',s.id,'session_number',s.session_number,'name',coalesce(nullif(trim(s.name),''),'Rodada '||s.session_number::text),'status',s.status,'win_pattern_code',s.win_pattern_code,'called_count',s.called_count,'last_called_number',s.last_called_number,'called_numbers',to_jsonb(called),'is_winner',winners_count>0) end,
    'updated_at',now()
  );
end;
$$;
revoke all on function public.get_my_buyer_digital_card(uuid,uuid) from public,anon;
grant execute on function public.get_my_buyer_digital_card(uuid,uuid) to authenticated;
