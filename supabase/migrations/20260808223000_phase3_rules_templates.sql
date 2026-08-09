-- Fase 3: regras matemáticas e templates de cartelas.
-- Estrutura pronta para o MVP de um organizador e reutilizável em vendedores/multi-organizador.

create type public.bingo_distribution_mode as enum ('any', 'column_ranges');
create type public.card_orientation as enum ('portrait', 'landscape');
create type public.card_page_size as enum ('A4', 'letter');
create type public.card_banner_position as enum ('top', 'bottom', 'none');

create table public.bingo_rule_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  code text not null check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  total_balls smallint not null check (total_balls between 5 and 500),
  grid_rows smallint not null check (grid_rows between 1 and 20),
  grid_columns smallint not null check (grid_columns between 1 and 20),
  numbers_per_game smallint not null check (numbers_per_game between 1 and 399),
  free_center boolean not null default false,
  distribution_mode public.bingo_distribution_mode not null default 'any',
  column_definitions jsonb not null default '[]'::jsonb,
  win_patterns jsonb not null default '[{"code":"full_card","name":"Cartela cheia","kind":"full_card"}]'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  locked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, code),
  check (numbers_per_game <= grid_rows * grid_columns),
  check ((free_center = false) or (grid_rows * grid_columns >= 3)),
  check (jsonb_typeof(column_definitions) = 'array'),
  check (jsonb_typeof(win_patterns) = 'array')
);

create unique index bingo_rule_sets_one_default_idx on public.bingo_rule_sets(event_id) where is_default;
create index bingo_rule_sets_event_idx on public.bingo_rule_sets(workspace_id, event_id, is_active, created_at);

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  physical_format smallint not null check (physical_format between 1 and 6),
  layout_key text not null check (layout_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  orientation public.card_orientation not null default 'portrait',
  page_size public.card_page_size not null default 'A4',
  banner_position public.card_banner_position not null default 'top',
  banner_height_mm numeric(6,2) not null default 28 check (banner_height_mm between 0 and 100),
  show_event_name boolean not null default true,
  show_event_date boolean not null default true,
  show_card_code boolean not null default true,
  show_series boolean not null default true,
  show_qr_code boolean not null default true,
  options jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name),
  check (jsonb_typeof(options) = 'object')
);

create unique index card_templates_one_default_per_format_idx on public.card_templates(event_id, physical_format) where is_default;
create index card_templates_event_idx on public.card_templates(workspace_id, event_id, physical_format, is_active);

alter table public.bingo_rule_sets enable row level security;
alter table public.card_templates enable row level security;

create policy bingo_rule_sets_member_select on public.bingo_rule_sets
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy bingo_rule_sets_admin_insert on public.bingo_rule_sets
for insert to authenticated with check (
  public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  and exists (select 1 from public.events e where e.id = event_id and e.workspace_id = workspace_id)
);
create policy bingo_rule_sets_admin_update on public.bingo_rule_sets
for update to authenticated using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
create policy bingo_rule_sets_admin_delete on public.bingo_rule_sets
for delete to authenticated using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create policy card_templates_member_select on public.card_templates
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy card_templates_admin_insert on public.card_templates
for insert to authenticated with check (
  public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  and exists (select 1 from public.events e where e.id = event_id and e.workspace_id = workspace_id)
);
create policy card_templates_admin_update on public.card_templates
for update to authenticated using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
create policy card_templates_admin_delete on public.card_templates
for delete to authenticated using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create trigger bingo_rule_sets_set_updated_at before update on public.bingo_rule_sets for each row execute function public.set_updated_at();
create trigger card_templates_set_updated_at before update on public.card_templates for each row execute function public.set_updated_at();

create or replace function public.protect_locked_bingo_rule_set() returns trigger language plpgsql set search_path=public as $$
begin
  if old.locked_at is not null and (
    new.total_balls is distinct from old.total_balls or
    new.grid_rows is distinct from old.grid_rows or
    new.grid_columns is distinct from old.grid_columns or
    new.numbers_per_game is distinct from old.numbers_per_game or
    new.free_center is distinct from old.free_center or
    new.distribution_mode is distinct from old.distribution_mode or
    new.column_definitions is distinct from old.column_definitions
  ) then
    raise exception 'locked bingo rule cannot change its mathematical definition';
  end if;
  return new;
end; $$;
create trigger bingo_rule_sets_protect_locked before update on public.bingo_rule_sets for each row execute function public.protect_locked_bingo_rule_set();

create or replace function public.validate_bingo_rule_set_payload(
  total_balls_value integer,
  rows_value integer,
  columns_value integer,
  numbers_per_game_value integer,
  free_center_value boolean,
  distribution_value public.bingo_distribution_mode,
  definitions jsonb
) returns void language plpgsql immutable set search_path = public as $$
declare
  item jsonb;
  total_slots integer := 0;
  range_size integer;
begin
  if total_balls_value < 5 or total_balls_value > 500 then raise exception 'invalid total balls'; end if;
  if rows_value < 1 or rows_value > 20 or columns_value < 1 or columns_value > 20 then raise exception 'invalid grid'; end if;
  if numbers_per_game_value < 1 or numbers_per_game_value > rows_value * columns_value then raise exception 'invalid numbers per game'; end if;
  if free_center_value and (rows_value % 2 = 0 or columns_value % 2 = 0) then raise exception 'free center requires odd grid dimensions'; end if;
  if free_center_value and numbers_per_game_value <> rows_value * columns_value - 1 then raise exception 'free center requires one less number than grid slots'; end if;
  if not free_center_value and numbers_per_game_value <> rows_value * columns_value then raise exception 'numbers per game must fill the grid'; end if;

  if distribution_value = 'column_ranges' then
    if jsonb_typeof(definitions) <> 'array' or jsonb_array_length(definitions) <> columns_value then
      raise exception 'column definitions must match grid columns';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(definitions) with ordinality a(value, pos)
      join jsonb_array_elements(definitions) with ordinality b(value, pos) on a.pos < b.pos
      where (a.value->>'min')::integer <= (b.value->>'max')::integer
        and (b.value->>'min')::integer <= (a.value->>'max')::integer
    ) then
      raise exception 'column ranges cannot overlap';
    end if;
    for item in select value from jsonb_array_elements(definitions)
    loop
      if not (item ? 'label' and item ? 'min' and item ? 'max' and item ? 'count') then raise exception 'invalid column definition'; end if;
      if (item->>'min')::integer < 1 or (item->>'max')::integer > total_balls_value or (item->>'min')::integer > (item->>'max')::integer then raise exception 'invalid column range'; end if;
      range_size := (item->>'max')::integer - (item->>'min')::integer + 1;
      if (item->>'count')::integer < 0 or (item->>'count')::integer > range_size then raise exception 'invalid column count'; end if;
      total_slots := total_slots + (item->>'count')::integer;
    end loop;
    if total_slots <> numbers_per_game_value then raise exception 'column counts must equal numbers per game'; end if;
  end if;
end;
$$;

create or replace function public.create_bingo_rule_set(
  target_workspace_id uuid,
  target_event_id uuid,
  rule_name text,
  rule_code text,
  rule_total_balls integer,
  rule_grid_rows integer,
  rule_grid_columns integer,
  rule_numbers_per_game integer,
  rule_free_center boolean,
  rule_distribution public.bingo_distribution_mode,
  rule_column_definitions jsonb default '[]'::jsonb,
  rule_win_patterns jsonb default '[{"code":"full_card","name":"Cartela cheia","kind":"full_card"}]'::jsonb,
  make_default boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'rule creation denied'; end if;
  if not exists(select 1 from public.events where id=target_event_id and workspace_id=target_workspace_id) then raise exception 'event not found'; end if;
  perform public.validate_bingo_rule_set_payload(rule_total_balls, rule_grid_rows, rule_grid_columns, rule_numbers_per_game, rule_free_center, rule_distribution, rule_column_definitions);
  if jsonb_typeof(rule_win_patterns) <> 'array' or jsonb_array_length(rule_win_patterns)=0 then raise exception 'at least one win pattern required'; end if;

  if make_default then update public.bingo_rule_sets set is_default=false where event_id=target_event_id and is_default; end if;
  insert into public.bingo_rule_sets(workspace_id,event_id,name,code,total_balls,grid_rows,grid_columns,numbers_per_game,free_center,distribution_mode,column_definitions,win_patterns,is_default)
  values(target_workspace_id,target_event_id,trim(rule_name),lower(trim(rule_code)),rule_total_balls,rule_grid_rows,rule_grid_columns,rule_numbers_per_game,rule_free_center,rule_distribution,rule_column_definitions,rule_win_patterns,make_default)
  returning id into new_id;
  perform public.log_audit(target_workspace_id,'bingo_rule.created','bingo_rule_set',new_id::text,jsonb_build_object('event_id',target_event_id,'code',rule_code));
  return new_id;
end; $$;
revoke all on function public.create_bingo_rule_set(uuid,uuid,text,text,integer,integer,integer,integer,boolean,public.bingo_distribution_mode,jsonb,jsonb,boolean) from public;
grant execute on function public.create_bingo_rule_set(uuid,uuid,text,text,integer,integer,integer,integer,boolean,public.bingo_distribution_mode,jsonb,jsonb,boolean) to authenticated;

create or replace function public.set_default_bingo_rule(target_rule_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare w uuid; e uuid;
begin
  select workspace_id,event_id into w,e from public.bingo_rule_sets where id=target_rule_id;
  if w is null then raise exception 'rule not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  update public.bingo_rule_sets set is_default=false where event_id=e and is_default;
  update public.bingo_rule_sets set is_default=true where id=target_rule_id;
  perform public.log_audit(w,'bingo_rule.default_changed','bingo_rule_set',target_rule_id::text,jsonb_build_object('event_id',e));
end; $$;
revoke all on function public.set_default_bingo_rule(uuid) from public;
grant execute on function public.set_default_bingo_rule(uuid) to authenticated;

create or replace function public.create_card_template(
  target_workspace_id uuid,
  target_event_id uuid,
  template_name text,
  template_format integer,
  template_layout_key text,
  template_orientation public.card_orientation,
  template_page_size public.card_page_size,
  template_banner_position public.card_banner_position,
  template_banner_height_mm numeric,
  template_options jsonb default '{}'::jsonb,
  make_default boolean default false
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'template creation denied'; end if;
  if not exists(select 1 from public.events where id=target_event_id and workspace_id=target_workspace_id) then raise exception 'event not found'; end if;
  if template_format < 1 or template_format > 6 then raise exception 'invalid format'; end if;
  if make_default then update public.card_templates set is_default=false where event_id=target_event_id and physical_format=template_format and is_default; end if;
  insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,options,is_default)
  values(target_workspace_id,target_event_id,trim(template_name),template_format,template_layout_key,template_orientation,template_page_size,template_banner_position,template_banner_height_mm,coalesce(template_options,'{}'::jsonb),make_default)
  returning id into new_id;
  perform public.log_audit(target_workspace_id,'card_template.created','card_template',new_id::text,jsonb_build_object('event_id',target_event_id,'format',template_format));
  return new_id;
end; $$;
revoke all on function public.create_card_template(uuid,uuid,text,integer,text,public.card_orientation,public.card_page_size,public.card_banner_position,numeric,jsonb,boolean) from public;
grant execute on function public.create_card_template(uuid,uuid,text,integer,text,public.card_orientation,public.card_page_size,public.card_banner_position,numeric,jsonb,boolean) to authenticated;

create or replace function public.set_default_card_template(target_template_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare w uuid; e uuid; f integer;
begin
  select workspace_id,event_id,physical_format into w,e,f from public.card_templates where id=target_template_id;
  if w is null then raise exception 'template not found'; end if;
  if not public.has_workspace_role(w,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  update public.card_templates set is_default=false where event_id=e and physical_format=f and is_default;
  update public.card_templates set is_default=true where id=target_template_id;
end; $$;
revoke all on function public.set_default_card_template(uuid) from public;
grant execute on function public.set_default_card_template(uuid) to authenticated;

-- Preenche uma configuração padrão de bingo 75 bolas e templates 1/2/3 em 1.
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

  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=1) then
    insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,is_default)
    values(w,target_event_id,'1 em 1 · Clássico',1,'single_classic','portrait','A4','top',30,true);
  end if;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=2) then
    insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,is_default)
    values(w,target_event_id,'2 em 1 · Vertical',2,'double_vertical','portrait','A4','top',26,true);
  end if;
  if not exists(select 1 from public.card_templates where event_id=target_event_id and physical_format=3) then
    insert into public.card_templates(workspace_id,event_id,name,physical_format,layout_key,orientation,page_size,banner_position,banner_height_mm,is_default)
    values(w,target_event_id,'3 em 1 · Horizontal',3,'triple_horizontal','landscape','A4','top',22,true);
  end if;
end; $$;
revoke all on function public.ensure_event_card_defaults(uuid) from public;
grant execute on function public.ensure_event_card_defaults(uuid) to authenticated;

-- Existing events receive defaults lazily from the UI/RPC. Future events also get defaults on first use.
