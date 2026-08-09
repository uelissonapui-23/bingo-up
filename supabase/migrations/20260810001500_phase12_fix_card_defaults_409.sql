-- Fase 12.7: torna a inicialização de regras/layouts idempotente.
-- Corrige HTTP 409/23505 causado por presets antigos e novos coexistindo.

create or replace function public.ensure_event_layout_presets(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  w uuid;
  chosen uuid;
begin
  select workspace_id into w from public.events where id=target_event_id;
  if w is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'access denied';
  end if;

  -- Migra defaults legados apenas quando isso não colide com um preset novo já existente.
  update public.card_templates t
     set name='1 em 1 · Destaque', layout_key='single_showcase', orientation='portrait', page_size='A4',
         banner_position='none', banner_height_mm=0,
         options=case when t.options is null or t.options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else t.options end
   where t.event_id=target_event_id and t.physical_format=1 and t.layout_key='single_classic'
     and not exists(select 1 from public.card_templates x where x.event_id=target_event_id and (x.layout_key='single_showcase' or x.name='1 em 1 · Destaque'));

  update public.card_templates t
     set name='2 em 1 · Dois grandes', layout_key='double_equal', orientation='portrait', page_size='A4',
         banner_position='none', banner_height_mm=0,
         options=case when t.options is null or t.options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else t.options end
   where t.event_id=target_event_id and t.physical_format=2 and t.layout_key='double_vertical'
     and not exists(select 1 from public.card_templates x where x.event_id=target_event_id and (x.layout_key='double_equal' or x.name='2 em 1 · Dois grandes'));

  update public.card_templates t
     set name='3 em 1 · Principal + 2', layout_key='triple_main_two', orientation='portrait', page_size='A4',
         banner_position='none', banner_height_mm=0,
         options=case when t.options is null or t.options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else t.options end
   where t.event_id=target_event_id and t.physical_format=3 and t.layout_key='triple_horizontal'
     and not exists(select 1 from public.card_templates x where x.event_id=target_event_id and (x.layout_key='triple_main_two' or x.name='3 em 1 · Principal + 2'));

  -- Se o preset novo já existe, o legado deixa de disputar o papel de padrão, sem ser apagado
  -- (lotes antigos podem referenciá-lo).
  update public.card_templates t set is_default=false, is_active=false
   where t.event_id=target_event_id and t.layout_key='single_classic'
     and exists(select 1 from public.card_templates x where x.event_id=target_event_id and x.id<>t.id and (x.layout_key='single_showcase' or x.name='1 em 1 · Destaque'));
  update public.card_templates t set is_default=false, is_active=false
   where t.event_id=target_event_id and t.layout_key='double_vertical'
     and exists(select 1 from public.card_templates x where x.event_id=target_event_id and x.id<>t.id and (x.layout_key='double_equal' or x.name='2 em 1 · Dois grandes'));
  update public.card_templates t set is_default=false, is_active=false
   where t.event_id=target_event_id and t.layout_key='triple_horizontal'
     and exists(select 1 from public.card_templates x where x.event_id=target_event_id and x.id<>t.id and (x.layout_key='triple_main_two' or x.name='3 em 1 · Principal + 2'));

  -- Presets oficiais. A verificação considera tanto a chave quanto o nome para não violar
  -- unique(event_id, name) quando há dados de versões anteriores.
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Destaque',1,'single_showcase','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='single_showcase' or name='1 em 1 · Destaque'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Jogo inferior',1,'single_lower','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='single_lower' or name='1 em 1 · Jogo inferior'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Compacto',1,'single_compact','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='single_compact' or name='1 em 1 · Compacto'));

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Dois grandes',2,'double_equal','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='double_equal' or name='2 em 1 · Dois grandes'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Principal + apoio',2,'double_feature','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='double_feature' or name='2 em 1 · Principal + apoio'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Lado a lado',2,'double_side_by_side','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='double_side_by_side' or name='2 em 1 · Lado a lado'));

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Principal + 2',3,'triple_main_two','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='triple_main_two' or name='3 em 1 · Principal + 2'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Empilhados',3,'triple_stacked','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='triple_stacked' or name='3 em 1 · Empilhados'));
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Equilibrado',3,'triple_equal','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and (layout_key='triple_equal' or name='3 em 1 · Equilibrado'));

  -- Garante exatamente um padrão por formato quando ainda não houver um.
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=1 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=1 and is_active order by (layout_key='single_showcase') desc, created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
  chosen:=null;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=2 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=2 and is_active order by (layout_key='double_equal') desc, created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
  chosen:=null;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=3 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=3 and is_active order by (layout_key='triple_main_two') desc, created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
end;
$$;

revoke all on function public.ensure_event_layout_presets(uuid) from public;
grant execute on function public.ensure_event_layout_presets(uuid) to authenticated;

create or replace function public.ensure_event_card_defaults(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare w uuid;
begin
  select workspace_id into w from public.events where id=target_event_id;
  if w is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;

  insert into public.bingo_rule_sets(workspace_id,event_id,name,code,total_balls,grid_rows,grid_columns,numbers_per_game,free_center,distribution_mode,column_definitions,win_patterns,is_default)
  select w,target_event_id,'Bingo 75 bolas','bingo_75',75,5,5,24,true,'column_ranges',
    '[{"label":"B","min":1,"max":15,"count":5},{"label":"I","min":16,"max":30,"count":5},{"label":"N","min":31,"max":45,"count":4},{"label":"G","min":46,"max":60,"count":5},{"label":"O","min":61,"max":75,"count":5}]'::jsonb,
    '[{"code":"one_line","name":"1 linha","kind":"line"},{"code":"two_lines","name":"2 linhas","kind":"two_lines"},{"code":"full_card","name":"Cartela cheia","kind":"full_card"}]'::jsonb,
    not exists(select 1 from public.bingo_rule_sets where event_id=target_event_id and is_default)
  where not exists(select 1 from public.bingo_rule_sets where event_id=target_event_id and code='bingo_75');

  perform public.ensure_event_layout_presets(target_event_id);
end;
$$;

revoke all on function public.ensure_event_card_defaults(uuid) from public;
grant execute on function public.ensure_event_card_defaults(uuid) to authenticated;

notify pgrst, 'reload schema';
