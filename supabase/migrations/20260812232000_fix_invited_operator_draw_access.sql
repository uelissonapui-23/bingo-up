-- Corrige acesso operacional de contas antigas/convidadas sem platform_user_controls.
-- A ausência de um registro de controle não deve bloquear vendedor/operador que já
-- possui atribuição explícita e ativa no evento. Bloqueios explícitos continuam valendo.

create or replace function public.operational_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(
      select 1
      from public.platform_members pm
      where pm.user_id=target_user_id
        and pm.role='platform_owner'
    )
    or coalesce(
      (
        select
          c.access_status='active'
          or (
            c.access_status='suspended'
            and c.reason in (
              'Aguardando liberação comercial',
              'Acesso operacional por convite; licença de organizador não liberada'
            )
          )
        from public.platform_user_controls c
        where c.user_id=target_user_id
      ),
      true
    );
$$;

revoke all on function public.operational_user_access_allowed(uuid) from public;
grant execute on function public.operational_user_access_allowed(uuid) to authenticated;

-- Reafirma os helpers usando a regra corrigida. A permissão continua exigindo:
-- atribuição ativa ao evento + vínculo operacional ativo + workspace/licença ativos.
create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.operational_user_access_allowed(target_user_id) and exists(
      select 1 from public.event_seller_assignments a
      join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller'
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.seller_user_id=target_user_id and a.is_active and m.status='active'
        and w.is_active and public.workspace_license_active(a.workspace_id)
    )
  );
$$;

create or replace function public.draw_operator_has_event_access(target_event_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.operational_user_access_allowed(target_user_id) and exists(
      select 1 from public.event_draw_operator_assignments a
      join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator'
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.operator_user_id=target_user_id and a.is_active and m.status='active'
        and w.is_active and public.workspace_license_active(a.workspace_id)
    )
  );
$$;

revoke all on function public.seller_has_event_access(uuid,uuid) from public;
revoke all on function public.draw_operator_has_event_access(uuid,uuid) from public;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;
grant execute on function public.draw_operator_has_event_access(uuid,uuid) to authenticated;
