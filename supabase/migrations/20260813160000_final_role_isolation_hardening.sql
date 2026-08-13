-- Auditoria final de isolamento multi-papel.
-- Reduz superficie de enumeracao de permissoes sem alterar o fluxo normal de cada papel.

create or replace function public.operational_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case
    when auth.uid() is null or target_user_id is null then false
    when target_user_id <> auth.uid() and not public.is_platform_owner() then false
    else
      exists(select 1 from public.platform_members pm where pm.user_id=target_user_id and pm.role='platform_owner')
      or coalesce((
        select c.access_status='active'
          or (c.access_status='suspended' and c.reason in ('Aguardando liberação comercial','Acesso operacional por convite; licença de organizador não liberada'))
        from public.platform_user_controls c where c.user_id=target_user_id
      ),true)
  end;
$$;
revoke all on function public.operational_user_access_allowed(uuid) from public,anon,authenticated;

create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null or target_event_id is null or target_user_id is null then false
    when target_user_id <> auth.uid() and not public.is_platform_owner() then false
    else public.is_platform_owner() or (
      public.operational_user_access_allowed(target_user_id) and exists(
        select 1 from public.event_seller_assignments a
        join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller'
        join public.workspaces w on w.id=a.workspace_id
        where a.event_id=target_event_id and a.seller_user_id=target_user_id and a.is_active and m.status='active'
          and w.is_active and public.workspace_license_active(a.workspace_id)
      )
    )
  end;
$$;

create or replace function public.draw_operator_has_event_access(target_event_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when auth.uid() is null or target_event_id is null or target_user_id is null then false
    when target_user_id <> auth.uid() and not public.is_platform_owner() then false
    else public.is_platform_owner() or (
      public.operational_user_access_allowed(target_user_id) and exists(
        select 1 from public.event_draw_operator_assignments a
        join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator'
        join public.workspaces w on w.id=a.workspace_id
        where a.event_id=target_event_id and a.operator_user_id=target_user_id and a.is_active and m.status='active'
          and w.is_active and public.workspace_license_active(a.workspace_id)
      )
    )
  end;
$$;
revoke all on function public.seller_has_event_access(uuid,uuid) from public,anon;
revoke all on function public.draw_operator_has_event_access(uuid,uuid) from public,anon;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;
grant execute on function public.draw_operator_has_event_access(uuid,uuid) to authenticated;

-- A tabela de vinculos operacionais e somente leitura no cliente; toda mutacao passa pelas RPCs auditadas.
revoke insert,update,delete,truncate,references,trigger on table public.workspace_operational_memberships from authenticated,anon;
grant select on table public.workspace_operational_memberships to authenticated;

-- Tabelas globais da plataforma nunca devem aceitar escrita direta de usuarios comuns.
revoke insert,update,delete,truncate,references,trigger on table public.platform_members from authenticated,anon;
revoke insert,update,delete,truncate,references,trigger on table public.platform_user_controls from authenticated,anon;

-- Confirma que o acesso do comprador autenticado depende de e-mail confirmado e compra concluida.
create or replace function public.get_my_buyer_event(target_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare my_email text; email_confirmed timestamptz; draw_token uuid; event_row public.events%rowtype; win_count int; latest_session_id uuid; latest_prize text; my_latest_winners int:=0; total_latest_winners int:=0; buyer_label text;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select lower(email),email_confirmed_at into my_email,email_confirmed from auth.users where id=auth.uid();
 if my_email is null or email_confirmed is null then raise exception 'confirmed buyer email required'; end if;
 if not exists(select 1 from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' where s.event_id=target_event_id and s.status='completed' and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email)) then raise exception 'buyer access denied'; end if;
 select * into event_row from public.events where id=target_event_id;
 if event_row.id is null then raise exception 'event not found'; end if;
 select ds.public_token into draw_token from public.draw_sessions ds where ds.event_id=target_event_id order by case when ds.status in ('active','paused') then 0 else 1 end,ds.session_number desc limit 1;
 select count(*) into win_count from public.winners wi join public.sale_items si on si.physical_card_id=wi.physical_card_id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.event_id=target_event_id and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email);
 select wi.session_id,coalesce(nullif(trim(ds.name),''),'Rodada '||ds.session_number::text) into latest_session_id,latest_prize from public.winners wi join public.draw_sessions ds on ds.id=wi.session_id join public.sale_items si on si.physical_card_id=wi.physical_card_id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.event_id=target_event_id and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email) order by wi.confirmed_at desc limit 1;
 if latest_session_id is not null then select count(*) into total_latest_winners from public.winners where session_id=latest_session_id; select count(*) into my_latest_winners from public.winners wi join public.sale_items si on si.physical_card_id=wi.physical_card_id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.session_id=latest_session_id and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email); end if;
 select nullif(trim(s.buyer_name),'') into buyer_label from public.sales s where s.event_id=target_event_id and s.status='completed' and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email) and nullif(trim(s.buyer_name),'') is not null order by s.completed_at desc nulls last limit 1;
 return jsonb_build_object(
 'event',jsonb_build_object('id',event_row.id,'name',event_row.name,'status',event_row.status),'public_session_token',draw_token,'winner_count',win_count,'winner_prizes','[]'::jsonb,
 'latest_win',case when latest_session_id is null then null else jsonb_build_object('prize',latest_prize,'my_winners',my_latest_winners,'total_winners',total_latest_winners,'buyer_name',buyer_label) end,
 'wins',coalesce((select jsonb_agg(jsonb_build_object('winner_id',wi.id,'prize',coalesce(nullif(ds.win_pattern_snapshot->>'name',''),ds.win_pattern_code),'round_name',coalesce(nullif(trim(ds.name),''),'Rodada '||ds.session_number::text),'card_code',pc.code,'game_position',cg.position,'confirmed_at',wi.confirmed_at,'delivered',coalesce(pd.delivered,false)) order by wi.confirmed_at desc) from public.winners wi join public.draw_sessions ds on ds.id=wi.session_id join public.physical_cards pc on pc.id=wi.physical_card_id join public.card_games cg on cg.id=wi.card_game_id join public.sale_items si on si.physical_card_id=pc.id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' left join public.winner_prize_deliveries pd on pd.winner_id=wi.id where wi.event_id=target_event_id and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email)),'[]'::jsonb),
 'cards',coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'code',pc.code,'public_token',pc.public_token,'physical_format',pc.physical_format,'buyer_name',s.buyer_name,'is_winner',exists(select 1 from public.winners wi where wi.event_id=target_event_id and wi.physical_card_id=pc.id)) order by pc.sequence_number) from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' where s.event_id=target_event_id and s.status='completed' and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email)),'[]'::jsonb));
end; $$;
revoke all on function public.get_my_buyer_event(uuid) from public,anon;
grant execute on function public.get_my_buyer_event(uuid) to authenticated;

-- A Central de Acessos tambem so associa compras digitais a um e-mail confirmado.
create or replace function public.list_my_access_centers()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare my_email text; email_confirmed timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email),email_confirmed_at into my_email,email_confirmed from auth.users where id=auth.uid();
  return jsonb_build_object(
    'is_master',public.is_platform_owner(),
    'organizers',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'role',wm.role::text) order by w.name) from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id where wm.user_id=auth.uid() and wm.status='active' and wm.role::text in ('organizer_owner','organizer_admin','event_manager') and w.is_active),'[]'::jsonb),
    'seller_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at) order by e.starts_at nulls last,e.name) from public.event_seller_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.seller_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
    'operator_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at) order by e.starts_at nulls last,e.name) from public.event_draw_operator_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.operator_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
    'buyer_events',case when email_confirmed is null or my_email is null then '[]'::jsonb else coalesce((select jsonb_agg(x.obj order by x.starts_at nulls last,x.event_name) from (select e.id as event_id,e.name event_name,e.starts_at,jsonb_build_object('event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at,'organizer_name',w.name,'cards',count(distinct si.physical_card_id)) obj from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' join public.events e on e.id=s.event_id join public.workspaces w on w.id=s.workspace_id where s.status='completed' and lower(trim(coalesce(s.buyer_email,'')))=trim(my_email) group by e.id,e.name,e.status,e.starts_at,w.name)x),'[]'::jsonb) end
  );
end; $$;
revoke all on function public.list_my_access_centers() from public,anon;
grant execute on function public.list_my_access_centers() to authenticated;
