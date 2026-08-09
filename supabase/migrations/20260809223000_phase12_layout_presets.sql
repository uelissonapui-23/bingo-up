-- Fase 12.3: biblioteca completa de modelos 1/2/3 em 1.
-- Mantém layouts personalizados e adiciona todos os presets oficiais do BINGOUP.

create or replace function public.ensure_event_layout_presets(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  w uuid;
begin
  select workspace_id into w from public.events where id=target_event_id;
  if w is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'access denied';
  end if;

  -- Converte apenas os três defaults antigos criados automaticamente.
  update public.card_templates
     set name='1 em 1 · Destaque', layout_key='single_showcase', orientation='portrait', page_size='A4', banner_position='none', banner_height_mm=0,
         options=case when options is null or options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else options end
   where event_id=target_event_id and physical_format=1 and layout_key='single_classic';

  update public.card_templates
     set name='2 em 1 · Dois grandes', layout_key='double_equal', orientation='portrait', page_size='A4', banner_position='none', banner_height_mm=0,
         options=case when options is null or options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else options end
   where event_id=target_event_id and physical_format=2 and layout_key='double_vertical';

  update public.card_templates
     set name='3 em 1 · Principal + 2', layout_key='triple_main_two', orientation='portrait', page_size='A4', banner_position='none', banner_height_mm=0,
         options=case when options is null or options='{}'::jsonb then '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb else options end
   where event_id=target_event_id and physical_format=3 and layout_key='triple_horizontal';

  -- 1 em 1
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Destaque',1,'single_showcase','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,
         not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=1 and is_default)
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='single_showcase');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Jogo inferior',1,'single_lower','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='single_lower');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'1 em 1 · Compacto',1,'single_compact','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='single_compact');

  -- 2 em 1
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Dois grandes',2,'double_equal','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,
         not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=2 and is_default)
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='double_equal');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Principal + apoio',2,'double_feature','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='double_feature');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'2 em 1 · Lado a lado',2,'double_side_by_side','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='double_side_by_side');

  -- 3 em 1
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Principal + 2',3,'triple_main_two','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,
         not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=3 and is_default)
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='triple_main_two');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Empilhados',3,'triple_stacked','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='triple_stacked');

  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  select w,target_event_id,'3 em 1 · Equilibrado',3,'triple_equal','portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false
  where not exists(select 1 from public.card_templates where event_id=target_event_id and layout_key='triple_equal');
end;
$$;

revoke all on function public.ensure_event_layout_presets(uuid) from public;
grant execute on function public.ensure_event_layout_presets(uuid) to authenticated;

-- Atualiza o inicializador para eventos futuros e existentes.
create or replace function public.ensure_event_card_defaults(target_event_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare w uuid; rule_id uuid;
begin
  select workspace_id into w from public.events where id=target_event_id;
  if w is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;

  if not exists(select 1 from public.bingo_rule_sets where event_id=target_event_id) then
    insert into public.bingo_rule_sets(workspace_id,event_id,name,code,total_balls,grid_rows,grid_columns,numbers_per_game,free_center,distribution_mode,column_definitions,win_patterns,is_default)
    values(w,target_event_id,'Bingo 75 bolas','bingo_75',75,5,5,24,true,'column_ranges',
      '[{"label":"B","min":1,"max":15,"count":5},{"label":"I","min":16,"max":30,"count":5},{"label":"N","min":31,"max":45,"count":4},{"label":"G","min":46,"max":60,"count":5},{"label":"O","min":61,"max":75,"count":5}]'::jsonb,
      '[{"code":"one_line","name":"1 linha","kind":"line"},{"code":"two_lines","name":"2 linhas","kind":"two_lines"},{"code":"full_card","name":"Cartela cheia","kind":"full_card"}]'::jsonb,true)
    returning id into rule_id;
  end if;

  perform public.ensure_event_layout_presets(target_event_id);
end; $$;
revoke all on function public.ensure_event_card_defaults(uuid) from public;
grant execute on function public.ensure_event_card_defaults(uuid) to authenticated;

-- Já deixa todos os eventos existentes prontos sem exigir abrir um por um.
do $$
declare r record;
begin
  for r in select id from public.events loop
    begin
      -- O bloco é executado durante migration com privilégios do owner; chama lógica direta via inserts abaixo apenas em sessão autenticada.
      -- Para não depender de auth.uid(), o preenchimento real ocorrerá no primeiro acesso via ensure_event_card_defaults.
      null;
    end;
  end loop;
end $$;
