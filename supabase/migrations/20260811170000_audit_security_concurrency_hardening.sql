-- Auditoria preventiva: bloqueio global coerente, concorrencia do limite comercial e integridade de papeis.
-- Preserva dados e contratos existentes; apenas fortalece regras ja expostas pelo painel Master.

-- platform_owner nunca pode ser bloqueado. platform_admin continua com suporte global,
-- mas agora respeita uma suspensao explicita feita pelo Master.
create or replace function public.platform_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_members pm where pm.user_id=target_user_id and pm.role='platform_owner')
    or coalesce((select c.access_status='active' from public.platform_user_controls c where c.user_id=target_user_id),true);
$$;
revoke all on function public.platform_user_access_allowed(uuid) from public;
grant execute on function public.platform_user_access_allowed(uuid) to authenticated;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.platform_user_access_allowed(auth.uid()) and (
      public.is_platform_admin() or exists (
        select 1 from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id
        where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
          and w.is_active and public.workspace_license_active(target_workspace_id)
      )
    )
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.platform_user_access_allowed(auth.uid()) and (
      public.is_platform_admin() or exists (
        select 1 from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id
        where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
          and wm.role=any(allowed_roles) and w.is_active and public.workspace_license_active(target_workspace_id)
      )
    )
  );
$$;

create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.platform_user_access_allowed(target_user_id) and (
      (target_user_id=auth.uid() and public.is_platform_admin()) or exists(
        select 1 from public.event_seller_assignments a
        join public.workspace_members wm on wm.workspace_id=a.workspace_id and wm.user_id=a.seller_user_id
        join public.workspaces w on w.id=a.workspace_id
        where a.event_id=target_event_id and a.seller_user_id=target_user_id and a.is_active
          and wm.status='active' and wm.role='seller' and w.is_active and public.workspace_license_active(a.workspace_id)
      )
    )
  );
$$;

create or replace function public.draw_operator_has_event_access(target_event_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.platform_user_access_allowed(target_user_id) and (
      (target_user_id=auth.uid() and public.is_platform_admin()) or exists(
        select 1 from public.event_draw_operator_assignments a
        join public.workspace_members wm on wm.workspace_id=a.workspace_id and wm.user_id=a.operator_user_id
        join public.workspaces w on w.id=a.workspace_id
        where a.event_id=target_event_id and a.operator_user_id=target_user_id and a.is_active
          and wm.status='active' and wm.role::text='draw_operator' and w.is_active and public.workspace_license_active(a.workspace_id)
      )
    )
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid,public.workspace_role[]) from public;
revoke all on function public.seller_has_event_access(uuid,uuid) from public;
revoke all on function public.draw_operator_has_event_access(uuid,uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid,public.workspace_role[]) to authenticated;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;
grant execute on function public.draw_operator_has_event_access(uuid,uuid) to authenticated;

-- Serializa criacoes de eventos do mesmo workspace. Sem este lock, duas requisicoes simultaneas
-- poderiam ler o mesmo contador e ultrapassar event_limit.
create or replace function public.enforce_workspace_event_license()
returns trigger language plpgsql security definer set search_path=public as $$
declare lim integer; current_count integer; stat text; expiry timestamptz;
begin
  if public.is_platform_owner() then return new; end if;
  if not public.platform_user_access_allowed(auth.uid()) then raise exception 'Seu acesso à plataforma está suspenso.'; end if;
  perform 1 from public.workspaces where id=new.workspace_id for update;
  if not found then raise exception 'workspace not found'; end if;
  select access_status,event_limit,valid_until into stat,lim,expiry from public.workspace_licenses where workspace_id=new.workspace_id;
  if stat is null then return new; end if;
  if stat<>'active' or (expiry is not null and expiry<now()) then raise exception 'A licença deste organizador não está ativa.'; end if;
  if lim is not null then
    select count(*) into current_count from public.events where workspace_id=new.workspace_id;
    if current_count>=lim then raise exception 'Limite de eventos da licença atingido (%).',lim; end if;
  end if;
  return new;
end; $$;

-- organizer_owner representa o owner real do workspace; evita criar um segundo "owner" apenas
-- alterando o enum de um membro, sem transferir owner_user_id.
create or replace function public.master_update_membership(target_workspace_id uuid,target_user_id uuid,target_role text,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare ws_owner uuid; new_role public.workspace_role; new_status public.membership_status;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  select owner_user_id into ws_owner from public.workspaces where id=target_workspace_id;
  if ws_owner is null then raise exception 'workspace not found'; end if;
  begin new_role:=target_role::public.workspace_role; exception when others then raise exception 'invalid workspace role'; end;
  begin new_status:=target_status::public.membership_status; exception when others then raise exception 'invalid membership status'; end;
  if target_user_id=ws_owner then
    if new_role<>'organizer_owner' or new_status<>'active' then raise exception 'workspace owner role cannot be changed or suspended here'; end if;
  elsif new_role='organizer_owner' then
    raise exception 'organizer_owner is reserved for the workspace owner';
  end if;
  update public.workspace_members set role=new_role,status=new_status,updated_at=now()
    where workspace_id=target_workspace_id and user_id=target_user_id;
  if not found then raise exception 'membership not found'; end if;
  insert into public.platform_master_audit_logs(actor_user_id,action,target_workspace_id,metadata)
  values(auth.uid(),'user.membership_updated',target_workspace_id,jsonb_build_object('user_id',target_user_id,'role',target_role,'status',target_status));
end; $$;
revoke all on function public.master_update_membership(uuid,uuid,text,text) from public;
grant execute on function public.master_update_membership(uuid,uuid,text,text) to authenticated;
