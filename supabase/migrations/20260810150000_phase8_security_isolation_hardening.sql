-- Etapa 8: robustez, isolamento multi-tenant e segurança de produção.
-- Objetivos:
-- 1) impedir vazamento de capability tokens do painel público;
-- 2) endurecer gestão de membros e impedir escalada para organizer_owner;
-- 3) impedir alteração/remoção direta do vínculo do proprietário;
-- 4) garantir consistência workspace_id <-> event_id em novas gravações;
-- 5) manter RLS como barreira principal, mesmo com Data API exposta.

-- ---------------------------------------------------------------------------
-- Painel público: o token é uma capability e não pode ser enumerado pela tabela.
-- O painel público passa a atualizar por RPC tokenizada; a tabela de sinais fica
-- acessível somente a membros autenticados do workspace correspondente.
-- ---------------------------------------------------------------------------
drop policy if exists public_panel_signals_anon_select on public.public_panel_signals;
drop policy if exists public_panel_signals_member_select on public.public_panel_signals;

create policy public_panel_signals_member_select on public.public_panel_signals
for select to authenticated
using (
  exists (
    select 1
    from public.draw_sessions ds
    where ds.id = public_panel_signals.session_id
      and public.is_workspace_member(ds.workspace_id)
  )
);

revoke select on table public.public_panel_signals from anon;
grant select on table public.public_panel_signals to authenticated;

-- ---------------------------------------------------------------------------
-- Gestão de membros: organizer_admin não pode criar/promover outro owner.
-- O proprietário real do workspace é imutável pelo Data API.
-- ---------------------------------------------------------------------------
drop policy if exists workspace_members_manage_admin on public.workspace_members;
drop policy if exists workspace_members_insert_guarded on public.workspace_members;
drop policy if exists workspace_members_update_guarded on public.workspace_members;
drop policy if exists workspace_members_delete_guarded on public.workspace_members;

create policy workspace_members_insert_guarded on public.workspace_members
for insert to authenticated
with check (
  public.is_platform_admin()
  or (
    public.has_workspace_role(workspace_id,array['organizer_owner']::public.workspace_role[])
    and role in ('organizer_admin','event_manager','seller')
  )
  or (
    public.has_workspace_role(workspace_id,array['organizer_admin']::public.workspace_role[])
    and role in ('event_manager','seller')
  )
);

create policy workspace_members_update_guarded on public.workspace_members
for update to authenticated
using (
  public.is_platform_admin()
  or (
    public.has_workspace_role(workspace_id,array['organizer_owner']::public.workspace_role[])
    and role <> 'organizer_owner'
  )
  or (
    public.has_workspace_role(workspace_id,array['organizer_admin']::public.workspace_role[])
    and role in ('event_manager','seller')
  )
)
with check (
  public.is_platform_admin()
  or (
    public.has_workspace_role(workspace_id,array['organizer_owner']::public.workspace_role[])
    and role in ('organizer_admin','event_manager','seller')
  )
  or (
    public.has_workspace_role(workspace_id,array['organizer_admin']::public.workspace_role[])
    and role in ('event_manager','seller')
  )
);

create policy workspace_members_delete_guarded on public.workspace_members
for delete to authenticated
using (
  public.is_platform_admin()
  or (
    public.has_workspace_role(workspace_id,array['organizer_owner']::public.workspace_role[])
    and role <> 'organizer_owner'
  )
  or (
    public.has_workspace_role(workspace_id,array['organizer_admin']::public.workspace_role[])
    and role in ('event_manager','seller')
  )
);

create or replace function public.protect_workspace_membership_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.workspaces where id=old.workspace_id;

  if tg_op='DELETE' then
    if old.user_id=owner_id then
      raise exception 'workspace owner membership cannot be deleted';
    end if;
    return old;
  end if;

  if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
    raise exception 'workspace membership identity cannot be changed';
  end if;

  if old.user_id=owner_id and (
    new.role is distinct from 'organizer_owner'::public.workspace_role
    or new.status is distinct from 'active'::public.membership_status
  ) then
    raise exception 'workspace owner membership cannot be revoked or downgraded';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_protect_owner on public.workspace_members;
create trigger workspace_members_protect_owner
before update or delete on public.workspace_members
for each row execute function public.protect_workspace_membership_identity();

-- ---------------------------------------------------------------------------
-- Consistência multi-tenant: novos registros não podem apontar para um evento
-- de outro workspace. FKs NOT VALID protegem novas operações imediatamente e
-- não derrubam a implantação por dados legados; a função de auditoria abaixo
-- permite verificar se existe legado inconsistente antes de validar tudo.
-- ---------------------------------------------------------------------------
create unique index if not exists events_id_workspace_uidx on public.events(id,workspace_id);

do $$
declare t text;
begin
  foreach t in array array[
    'event_settings','bingo_rule_sets','card_templates','card_batches','game_definitions',
    'physical_cards','card_games','card_print_jobs','sales','sale_items','draw_sessions',
    'draw_session_games','draw_numbers','game_progress','winner_candidates','winners'
  ] loop
    begin
      execute format(
        'alter table public.%I add constraint %I foreign key (event_id,workspace_id) references public.events(id,workspace_id) on delete cascade not valid',
        t, t||'_event_workspace_fk'
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

create or replace function public.audit_workspace_isolation(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb := '{}'::jsonb;
  t text;
  bad bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then
    raise exception 'access denied';
  end if;

  foreach t in array array[
    'event_settings','bingo_rule_sets','card_templates','card_batches','game_definitions',
    'physical_cards','card_games','card_print_jobs','sales','sale_items','draw_sessions',
    'draw_session_games','draw_numbers','game_progress','winner_candidates','winners'
  ] loop
    execute format(
      'select count(*) from public.%I x left join public.events e on e.id=x.event_id where x.workspace_id=$1 and (e.id is null or e.workspace_id<>x.workspace_id)',
      t
    ) into bad using target_workspace_id;
    result := result || jsonb_build_object(t,bad);
  end loop;

  return jsonb_build_object(
    'workspace_id',target_workspace_id,
    'checked_at',now(),
    'mismatches',result,
    'ok',not exists (
      select 1 from jsonb_each_text(result) x where x.value::bigint>0
    )
  );
end;
$$;
revoke all on function public.audit_workspace_isolation(uuid) from public;
grant execute on function public.audit_workspace_isolation(uuid) to authenticated;

-- Permissões explícitas finais do painel público.
notify pgrst, 'reload schema';
