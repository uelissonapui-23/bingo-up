-- Fase 4: motor de geração, lotes, catálogo de jogos e cartelas físicas.
-- Reutilizável pelo MVP, vendedores, impressão, sorteio e futura cartela digital.

create type public.card_batch_status as enum ('draft','generating','completed','failed','canceled');
create type public.generation_uniqueness_mode as enum ('strict','controlled');
create type public.physical_card_status as enum ('available','reserved','sold','canceled','void');

create table public.card_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rule_set_id uuid not null references public.bingo_rule_sets(id) on delete restrict,
  template_id uuid not null references public.card_templates(id) on delete restrict,
  series_code text not null check (series_code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$'),
  physical_format smallint not null check (physical_format between 1 and 6),
  requested_cards integer not null check (requested_cards between 1 and 1000000),
  requested_games bigint generated always as (requested_cards::bigint * physical_format::bigint) stored,
  start_number integer not null default 1 check (start_number >= 1),
  code_padding smallint not null default 5 check (code_padding between 1 and 12),
  uniqueness_mode public.generation_uniqueness_mode not null default 'strict',
  status public.card_batch_status not null default 'draft',
  generated_cards integer not null default 0 check (generated_cards >= 0),
  generated_games bigint not null default 0 check (generated_games >= 0),
  unique_games_created bigint not null default 0 check (unique_games_created >= 0),
  reused_games bigint not null default 0 check (reused_games >= 0),
  capacity_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(capacity_snapshot)='object'),
  generation_options jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_options)='object'),
  error_message text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, series_code)
);

create index card_batches_event_idx on public.card_batches(workspace_id,event_id,status,created_at desc);
create index card_batches_rule_idx on public.card_batches(rule_set_id,status);

create table public.game_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rule_set_id uuid not null references public.bingo_rule_sets(id) on delete restrict,
  signature text not null,
  numbers smallint[] not null,
  cells jsonb not null default '[]'::jsonb check (jsonb_typeof(cells)='array'),
  created_at timestamptz not null default now(),
  unique (rule_set_id, signature)
);
create index game_definitions_event_idx on public.game_definitions(workspace_id,event_id,rule_set_id);

create table public.physical_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  batch_id uuid not null references public.card_batches(id) on delete cascade,
  rule_set_id uuid not null references public.bingo_rule_sets(id) on delete restrict,
  template_id uuid not null references public.card_templates(id) on delete restrict,
  code text not null check (char_length(code) between 2 and 80),
  sequence_number integer not null check (sequence_number >= 1),
  physical_format smallint not null check (physical_format between 1 and 6),
  composition_signature text not null,
  public_token uuid not null default gen_random_uuid(),
  status public.physical_card_status not null default 'available',
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, code),
  unique (public_token),
  unique (batch_id, sequence_number)
);
create unique index physical_cards_unique_multi_composition_idx on public.physical_cards(rule_set_id,composition_signature) where physical_format > 1 and status <> 'void';
create index physical_cards_event_status_idx on public.physical_cards(workspace_id,event_id,status,sequence_number);
create index physical_cards_batch_idx on public.physical_cards(batch_id,sequence_number);
create index physical_cards_assignee_idx on public.physical_cards(event_id,assigned_to_user_id) where assigned_to_user_id is not null;

create table public.card_games (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  batch_id uuid not null references public.card_batches(id) on delete cascade,
  physical_card_id uuid not null references public.physical_cards(id) on delete cascade,
  game_definition_id uuid not null references public.game_definitions(id) on delete restrict,
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (physical_card_id, position),
  unique (physical_card_id, game_definition_id)
);
create index card_games_event_idx on public.card_games(workspace_id,event_id,batch_id);
create index card_games_definition_idx on public.card_games(game_definition_id);

alter table public.card_batches enable row level security;
alter table public.game_definitions enable row level security;
alter table public.physical_cards enable row level security;
alter table public.card_games enable row level security;

create policy card_batches_member_select on public.card_batches for select to authenticated using (public.is_workspace_member(workspace_id));
create policy game_definitions_member_select on public.game_definitions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy physical_cards_member_select on public.physical_cards for select to authenticated using (public.is_workspace_member(workspace_id));
create policy card_games_member_select on public.card_games for select to authenticated using (public.is_workspace_member(workspace_id));

-- Escritas passam pelas RPCs para manter as invariantes do gerador.

create trigger card_batches_set_updated_at before update on public.card_batches for each row execute function public.set_updated_at();
create trigger physical_cards_set_updated_at before update on public.physical_cards for each row execute function public.set_updated_at();

create or replace function public.canonical_numbers_signature(values_array smallint[]) returns text
language sql immutable strict as $$
  select string_agg(v::text,'-' order by v) from unnest(values_array) v;
$$;

create or replace function public.validate_generated_game(target_rule_id uuid, game_numbers smallint[], game_cells jsonb, expected_signature text)
returns void language plpgsql stable set search_path=public as $$
declare r public.bingo_rule_sets%rowtype; item jsonb; distinct_count integer; range_count integer; cell_values smallint[];
begin
  select * into r from public.bingo_rule_sets where id=target_rule_id;
  if r.id is null then raise exception 'rule not found'; end if;
  if cardinality(game_numbers) <> r.numbers_per_game then raise exception 'invalid number count'; end if;
  select count(distinct x) into distinct_count from unnest(game_numbers) x;
  if distinct_count <> r.numbers_per_game then raise exception 'duplicated number inside game'; end if;
  if (select min(x) from unnest(game_numbers) x) < 1 or (select max(x) from unnest(game_numbers) x) > r.total_balls then raise exception 'number outside rule universe'; end if;
  if public.canonical_numbers_signature(game_numbers) <> expected_signature then raise exception 'invalid game signature'; end if;
  if jsonb_typeof(game_cells) <> 'array' or jsonb_array_length(game_cells) <> r.grid_rows*r.grid_columns then raise exception 'invalid game cells'; end if;
  select coalesce(array_agg((value #>> '{}')::smallint order by (value #>> '{}')::smallint),'{}'::smallint[]) into cell_values
  from jsonb_array_elements(game_cells) where jsonb_typeof(value)='number';
  if cell_values <> (select coalesce(array_agg(x order by x),'{}'::smallint[]) from unnest(game_numbers) x) then raise exception 'cells do not match game numbers'; end if;
  if r.free_center then
    if (game_cells -> (floor(r.grid_rows/2.0)::int*r.grid_columns + floor(r.grid_columns/2.0)::int)) <> 'null'::jsonb then raise exception 'free center must be empty'; end if;
  end if;
  if r.distribution_mode='column_ranges' then
    for item in select * from jsonb_array_elements(r.column_definitions) loop
      select count(*) into range_count from unnest(game_numbers) n where n between (item->>'min')::integer and (item->>'max')::integer;
      if range_count <> (item->>'count')::integer then raise exception 'game violates column distribution'; end if;
    end loop;
  end if;
end; $$;

create or replace function public.create_card_batch(
  target_workspace_id uuid,
  target_event_id uuid,
  target_rule_set_id uuid,
  target_template_id uuid,
  batch_series_code text,
  batch_requested_cards integer,
  batch_start_number integer,
  batch_code_padding integer,
  batch_uniqueness_mode public.generation_uniqueness_mode,
  batch_capacity_snapshot jsonb default '{}'::jsonb,
  batch_generation_options jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; rule_record public.bingo_rule_sets%rowtype; template_record public.card_templates%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'generation denied'; end if;
  select * into rule_record from public.bingo_rule_sets where id=target_rule_set_id and workspace_id=target_workspace_id and event_id=target_event_id and is_active;
  if rule_record.id is null then raise exception 'active rule not found'; end if;
  select * into template_record from public.card_templates where id=target_template_id and workspace_id=target_workspace_id and event_id=target_event_id and is_active;
  if template_record.id is null then raise exception 'active template not found'; end if;
  if batch_requested_cards < 1 or batch_requested_cards > 1000000 then raise exception 'invalid requested card count'; end if;
  insert into public.card_batches(workspace_id,event_id,rule_set_id,template_id,series_code,physical_format,requested_cards,start_number,code_padding,uniqueness_mode,status,capacity_snapshot,generation_options,started_at)
  values(target_workspace_id,target_event_id,target_rule_set_id,target_template_id,upper(trim(batch_series_code)),template_record.physical_format,batch_requested_cards,batch_start_number,batch_code_padding,batch_uniqueness_mode,'generating',coalesce(batch_capacity_snapshot,'{}'::jsonb),coalesce(batch_generation_options,'{}'::jsonb),now())
  returning id into new_id;
  update public.bingo_rule_sets set locked_at=coalesce(locked_at,now()) where id=target_rule_set_id;
  perform public.log_audit(target_workspace_id,'card_batch.created','card_batch',new_id::text,jsonb_build_object('event_id',target_event_id,'requested_cards',batch_requested_cards,'format',template_record.physical_format,'mode',batch_uniqueness_mode));
  return new_id;
end; $$;
revoke all on function public.create_card_batch(uuid,uuid,uuid,uuid,text,integer,integer,integer,public.generation_uniqueness_mode,jsonb,jsonb) from public;
grant execute on function public.create_card_batch(uuid,uuid,uuid,uuid,text,integer,integer,integer,public.generation_uniqueness_mode,jsonb,jsonb) to authenticated;

create or replace function public.persist_generated_cards(target_batch_id uuid, cards_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.card_batches%rowtype; card_item jsonb; game_item jsonb; physical_id uuid; definition_id uuid; existing_definition_id uuid; repeats_on_card integer; chunk_cards integer:=0; chunk_games integer:=0; chunk_unique integer:=0; chunk_reused integer:=0; recomputed_composition text; signatures text[]; nums smallint[]; signature_value text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into b from public.card_batches where id=target_batch_id for update;
  if b.id is null then raise exception 'batch not found'; end if;
  if b.status <> 'generating' then raise exception 'batch is not generating'; end if;
  if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'generation denied'; end if;
  if jsonb_typeof(cards_payload)<>'array' then raise exception 'cards payload must be an array'; end if;
  if jsonb_array_length(cards_payload)>250 then raise exception 'chunk too large'; end if;

  for card_item in select * from jsonb_array_elements(cards_payload) loop
    if jsonb_array_length(card_item->'games') <> b.physical_format then raise exception 'invalid games per physical card'; end if;
    signatures := array[]::text[];
    repeats_on_card := 0;
    for game_item in select * from jsonb_array_elements(card_item->'games') order by (value->>'position')::integer loop
      signature_value := game_item->>'signature';
      select coalesce(array_agg(value::smallint order by ord),'{}'::smallint[]) into nums
      from jsonb_array_elements_text(game_item->'numbers') with ordinality as t(value,ord);
      perform public.validate_generated_game(b.rule_set_id,nums,game_item->'cells',signature_value);
      signatures := array_append(signatures,signature_value);
      existing_definition_id := null;
      select id into existing_definition_id from public.game_definitions where rule_set_id=b.rule_set_id and signature=signature_value;
      if existing_definition_id is null then
        insert into public.game_definitions(workspace_id,event_id,rule_set_id,signature,numbers,cells)
        values(b.workspace_id,b.event_id,b.rule_set_id,signature_value,nums,game_item->'cells')
        on conflict(rule_set_id,signature) do nothing returning id into definition_id;
        if definition_id is null then
          select id into definition_id from public.game_definitions where rule_set_id=b.rule_set_id and signature=signature_value;
          repeats_on_card := repeats_on_card + 1; chunk_reused := chunk_reused + 1;
        else
          chunk_unique := chunk_unique + 1;
        end if;
      else
        definition_id := existing_definition_id;
        repeats_on_card := repeats_on_card + 1; chunk_reused := chunk_reused + 1;
      end if;
      if array_length(signatures,1) <> (select count(distinct s) from unnest(signatures) s) then raise exception 'same game cannot repeat inside one physical card'; end if;
    end loop;
    if b.uniqueness_mode='strict' and repeats_on_card>0 then raise exception 'strict generation attempted to reuse a game'; end if;
    if b.uniqueness_mode='controlled' and b.physical_format>1 and repeats_on_card>1 then raise exception 'controlled mode allows at most one reused game per physical card'; end if;
    select string_agg(s,'|' order by s) into recomputed_composition from unnest(signatures) s;
    if recomputed_composition <> card_item->>'compositionSignature' then raise exception 'invalid physical composition signature'; end if;

    insert into public.physical_cards(workspace_id,event_id,batch_id,rule_set_id,template_id,code,sequence_number,physical_format,composition_signature)
    values(b.workspace_id,b.event_id,b.id,b.rule_set_id,b.template_id,card_item->>'code',(card_item->>'sequenceNumber')::integer,b.physical_format,recomputed_composition)
    returning id into physical_id;

    for game_item in select * from jsonb_array_elements(card_item->'games') loop
      select id into definition_id from public.game_definitions where rule_set_id=b.rule_set_id and signature=game_item->>'signature';
      insert into public.card_games(workspace_id,event_id,batch_id,physical_card_id,game_definition_id,position)
      values(b.workspace_id,b.event_id,b.id,physical_id,definition_id,(game_item->>'position')::integer);
      chunk_games:=chunk_games+1;
    end loop;
    chunk_cards:=chunk_cards+1;
  end loop;
  update public.card_batches set generated_cards=generated_cards+chunk_cards,generated_games=generated_games+chunk_games,unique_games_created=unique_games_created+chunk_unique,reused_games=reused_games+chunk_reused where id=b.id;
  return jsonb_build_object('cards',chunk_cards,'games',chunk_games,'unique_games',chunk_unique,'reused_games',chunk_reused);
end; $$;
revoke all on function public.persist_generated_cards(uuid,jsonb) from public;
grant execute on function public.persist_generated_cards(uuid,jsonb) to authenticated;

create or replace function public.finalize_card_batch(target_batch_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare b public.card_batches%rowtype;
begin
  select * into b from public.card_batches where id=target_batch_id for update;
  if b.id is null then raise exception 'batch not found'; end if;
  if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if b.status<>'generating' then raise exception 'batch is not generating'; end if;
  if b.generated_cards<>b.requested_cards or b.generated_games<>b.requested_games then raise exception 'batch is incomplete'; end if;
  update public.card_batches set status='completed',completed_at=now(),error_message=null where id=b.id;
  perform public.log_audit(b.workspace_id,'card_batch.completed','card_batch',b.id::text,jsonb_build_object('event_id',b.event_id,'cards',b.generated_cards,'games',b.generated_games,'unique_games',b.unique_games_created,'reused_games',b.reused_games));
end; $$;
revoke all on function public.finalize_card_batch(uuid) from public;
grant execute on function public.finalize_card_batch(uuid) to authenticated;

create or replace function public.cancel_card_batch(target_batch_id uuid, reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare b public.card_batches%rowtype;
begin
  select * into b from public.card_batches where id=target_batch_id for update;
  if b.id is null then raise exception 'batch not found'; end if;
  if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if b.status not in ('draft','generating','failed') then raise exception 'batch cannot be canceled'; end if;
  delete from public.physical_cards where batch_id=b.id;
  delete from public.game_definitions gd where gd.rule_set_id=b.rule_set_id and not exists(select 1 from public.card_games cg where cg.game_definition_id=gd.id);
  update public.card_batches set status='canceled',canceled_at=now(),error_message=left(reason,1000),generated_cards=0,generated_games=0,unique_games_created=0,reused_games=0 where id=b.id;
  perform public.log_audit(b.workspace_id,'card_batch.canceled','card_batch',b.id::text,jsonb_build_object('reason',reason));
end; $$;
revoke all on function public.cancel_card_batch(uuid,text) from public;
grant execute on function public.cancel_card_batch(uuid,text) to authenticated;

create or replace function public.mark_card_batch_failed(target_batch_id uuid, failure_message text) returns void language plpgsql security definer set search_path=public as $$
declare b public.card_batches%rowtype;
begin
  select * into b from public.card_batches where id=target_batch_id;
  if b.id is null then return; end if;
  if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if b.status='generating' then update public.card_batches set status='failed',error_message=left(failure_message,1000) where id=b.id; end if;
end; $$;
revoke all on function public.mark_card_batch_failed(uuid,text) from public;
grant execute on function public.mark_card_batch_failed(uuid,text) to authenticated;
