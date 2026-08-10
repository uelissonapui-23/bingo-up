-- Correção pós-Etapa 8 + expansão da biblioteca de layouts.
-- 1) remove FKs compostas redundantes que criaram ambiguidade de relacionamento no PostgREST;
-- 2) mantém o isolamento workspace/evento por trigger, sem criar um segundo relacionamento embutível;
-- 3) amplia a biblioteca oficial para 8 modelos 1-em-1, 10 modelos 2-em-1 e 10 modelos 3-em-1.

-- ---------------------------------------------------------------------------
-- Corrige ambiguidade PostgREST causada pelos FKs compostos da Etapa 8.
-- A FK simples event_id -> events(id) continua sendo a relação canônica usada nos embeds.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'event_settings','bingo_rule_sets','card_templates','card_batches','game_definitions',
    'physical_cards','card_games','card_print_jobs','sales','sale_items','draw_sessions',
    'draw_session_games','draw_numbers','game_progress','winner_candidates','winners'
  ] loop
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_event_workspace_fk');
  end loop;
end $$;

create or replace function public.enforce_event_workspace_match()
returns trigger
language plpgsql
set search_path=public
as $$
declare expected_workspace uuid;
begin
  if new.event_id is null or new.workspace_id is null then return new; end if;
  select workspace_id into expected_workspace from public.events where id=new.event_id;
  if expected_workspace is null then
    raise exception 'event not found';
  end if;
  if expected_workspace is distinct from new.workspace_id then
    raise exception 'workspace/event mismatch';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'event_settings','bingo_rule_sets','card_templates','card_batches','game_definitions',
    'physical_cards','card_games','card_print_jobs','sales','sale_items','draw_sessions',
    'draw_session_games','draw_numbers','game_progress','winner_candidates','winners'
  ] loop
    execute format('drop trigger if exists %I on public.%I',t||'_enforce_event_workspace',t);
    execute format(
      'create trigger %I before insert or update of event_id,workspace_id on public.%I for each row execute function public.enforce_event_workspace_match()',
      t||'_enforce_event_workspace',t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Biblioteca oficial de modelos. Os nomes/chaves precisam coincidir com layouts.ts.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_event_layout_presets(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  w uuid;
  chosen uuid;
  preset jsonb;
  presets constant jsonb := '[
    {"name":"1 em 1 · Destaque","format":1,"key":"single_showcase"},
    {"name":"1 em 1 · Jogo inferior","format":1,"key":"single_lower"},
    {"name":"1 em 1 · Compacto","format":1,"key":"single_compact"},
    {"name":"1 em 1 · Superior","format":1,"key":"single_upper"},
    {"name":"1 em 1 · Panorâmico","format":1,"key":"single_wide"},
    {"name":"1 em 1 · Lateral esquerda","format":1,"key":"single_left"},
    {"name":"1 em 1 · Lateral direita","format":1,"key":"single_right"},
    {"name":"1 em 1 · Base ampla","format":1,"key":"single_bottom_wide"},

    {"name":"2 em 1 · Dois grandes","format":2,"key":"double_equal"},
    {"name":"2 em 1 · Principal + apoio","format":2,"key":"double_feature"},
    {"name":"2 em 1 · Lado a lado","format":2,"key":"double_side_by_side"},
    {"name":"2 em 1 · Separados","format":2,"key":"double_spaced"},
    {"name":"2 em 1 · Diagonal","format":2,"key":"double_diagonal_down"},
    {"name":"2 em 1 · Diagonal invertida","format":2,"key":"double_diagonal_up"},
    {"name":"2 em 1 · Faixas centrais","format":2,"key":"double_wide_center"},
    {"name":"2 em 1 · Compactos","format":2,"key":"double_compact_stack"},
    {"name":"2 em 1 · Colunas altas","format":2,"key":"double_tall_columns"},
    {"name":"2 em 1 · Base dupla","format":2,"key":"double_lower_focus"},

    {"name":"3 em 1 · Principal + 2","format":3,"key":"triple_main_two"},
    {"name":"3 em 1 · Empilhados","format":3,"key":"triple_stacked"},
    {"name":"3 em 1 · Equilibrado","format":3,"key":"triple_equal"},
    {"name":"3 em 1 · Três colunas","format":3,"key":"triple_columns"},
    {"name":"3 em 1 · Principal à esquerda","format":3,"key":"triple_left_main"},
    {"name":"3 em 1 · Principal à direita","format":3,"key":"triple_right_main"},
    {"name":"3 em 1 · Dois em cima + base","format":3,"key":"triple_top_two_bottom"},
    {"name":"3 em 1 · Destaque superior","format":3,"key":"triple_bottom_two_top"},
    {"name":"3 em 1 · Diagonal dinâmica","format":3,"key":"triple_diagonal"},
    {"name":"3 em 1 · Trio compacto","format":3,"key":"triple_compact_stack"}
  ]'::jsonb;
begin
  select workspace_id into w from public.events where id=target_event_id;
  if w is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'access denied';
  end if;

  -- Legados continuam preservados quando um lote antigo os referencia, mas deixam de competir com a biblioteca oficial.
  update public.card_templates set is_default=false,is_active=false
   where event_id=target_event_id and layout_key in ('single_classic','double_vertical','triple_horizontal')
     and exists(select 1 from public.card_templates x where x.event_id=target_event_id and x.id<>card_templates.id and x.layout_key in ('single_showcase','double_equal','triple_main_two'));

  for preset in select value from jsonb_array_elements(presets) loop
    insert into public.card_templates(
      workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,
      banner_position,banner_height_mm,options,is_default,is_active
    )
    select w,target_event_id,preset->>'name',(preset->>'format')::smallint,preset->>'key',
      'portrait'::public.card_orientation,'A4'::public.card_page_size,'none'::public.card_banner_position,0,
      '{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false,true
    where not exists(
      select 1 from public.card_templates
      where event_id=target_event_id and (layout_key=preset->>'key' or name=preset->>'name')
    );
  end loop;

  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=1 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=1 and is_active order by (layout_key='single_showcase') desc,created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
  chosen:=null;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=2 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=2 and is_active order by (layout_key='double_equal') desc,created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
  chosen:=null;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=3 and is_default) then
    select id into chosen from public.card_templates where event_id=target_event_id and physical_format=3 and is_active order by (layout_key='triple_main_two') desc,created_at limit 1;
    if chosen is not null then update public.card_templates set is_default=true where id=chosen; end if;
  end if;
end;
$$;

revoke all on function public.ensure_event_layout_presets(uuid) from public;
grant execute on function public.ensure_event_layout_presets(uuid) to authenticated;

-- Alimenta eventos existentes sem depender de auth.uid() durante a migration.
with presets(name,format,key) as (values
 ('1 em 1 · Destaque',1,'single_showcase'),('1 em 1 · Jogo inferior',1,'single_lower'),('1 em 1 · Compacto',1,'single_compact'),('1 em 1 · Superior',1,'single_upper'),('1 em 1 · Panorâmico',1,'single_wide'),('1 em 1 · Lateral esquerda',1,'single_left'),('1 em 1 · Lateral direita',1,'single_right'),('1 em 1 · Base ampla',1,'single_bottom_wide'),
 ('2 em 1 · Dois grandes',2,'double_equal'),('2 em 1 · Principal + apoio',2,'double_feature'),('2 em 1 · Lado a lado',2,'double_side_by_side'),('2 em 1 · Separados',2,'double_spaced'),('2 em 1 · Diagonal',2,'double_diagonal_down'),('2 em 1 · Diagonal invertida',2,'double_diagonal_up'),('2 em 1 · Faixas centrais',2,'double_wide_center'),('2 em 1 · Compactos',2,'double_compact_stack'),('2 em 1 · Colunas altas',2,'double_tall_columns'),('2 em 1 · Base dupla',2,'double_lower_focus'),
 ('3 em 1 · Principal + 2',3,'triple_main_two'),('3 em 1 · Empilhados',3,'triple_stacked'),('3 em 1 · Equilibrado',3,'triple_equal'),('3 em 1 · Três colunas',3,'triple_columns'),('3 em 1 · Principal à esquerda',3,'triple_left_main'),('3 em 1 · Principal à direita',3,'triple_right_main'),('3 em 1 · Dois em cima + base',3,'triple_top_two_bottom'),('3 em 1 · Destaque superior',3,'triple_bottom_two_top'),('3 em 1 · Diagonal dinâmica',3,'triple_diagonal'),('3 em 1 · Trio compacto',3,'triple_compact_stack')
)
insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default,is_active)
select e.workspace_id,e.id,p.name,p.format,p.key,'portrait','A4','none',0,'{"version":1,"wildcard":{"kind":"star","scale":1}}'::jsonb,false,true
from public.events e cross join presets p
where not exists(select 1 from public.card_templates t where t.event_id=e.id and (t.layout_key=p.key or t.name=p.name));

notify pgrst, 'reload schema';
