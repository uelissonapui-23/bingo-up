-- Fase comercial: novos cadastros aguardam liberacao e possuem canal de suporte seguro com o Master.
-- Preserva usuarios existentes: todos os usuarios anteriores sem controle explicito sao marcados como ativos.

create table if not exists public.platform_support_settings (
  id smallint primary key default 1 check (id = 1),
  blocked_title text not null default 'Seu acesso ainda não foi liberado' check (char_length(blocked_title) between 3 and 120),
  blocked_message text not null default 'Sua conta foi criada com sucesso, mas o acesso ao BINGOUP precisa ser liberado pela empresa responsável. Entre em contato conosco para escolher ou confirmar seu acesso.' check (char_length(blocked_message) between 10 and 2000),
  whatsapp_number text,
  support_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_support_settings(id) values(1) on conflict(id) do nothing;

-- Antes de ativar o bloqueio por padrao, preserve o comportamento dos usuarios ja existentes.
insert into public.platform_user_controls(user_id,access_status,reason,updated_at)
select u.id,'active',null,now()
from auth.users u
where not exists(select 1 from public.platform_user_controls c where c.user_id=u.id)
on conflict(user_id) do nothing;

create or replace function public.initialize_new_platform_user_control()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.platform_user_controls(user_id,access_status,reason,updated_at)
  values(new.id,'suspended','Aguardando liberação comercial',now())
  on conflict(user_id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_initialize_new_platform_user_control on auth.users;
create trigger trg_initialize_new_platform_user_control
after insert on auth.users
for each row execute function public.initialize_new_platform_user_control();

-- Fail closed: conta sem registro de controle nao recebe acesso operacional por acidente.
create or replace function public.platform_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_members pm where pm.user_id=target_user_id and pm.role='platform_owner')
    or coalesce((select c.access_status='active' from public.platform_user_controls c where c.user_id=target_user_id),false);
$$;
revoke all on function public.platform_user_access_allowed(uuid) from public;
grant execute on function public.platform_user_access_allowed(uuid) to authenticated;

create or replace function public.get_my_platform_access()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'allowed', public.platform_user_access_allowed(auth.uid()),
    'status', case when public.platform_user_access_allowed(auth.uid()) then 'active' else 'suspended' end,
    'is_master', public.is_platform_owner(),
    'blocked_title', s.blocked_title,
    'blocked_message', s.blocked_message,
    'whatsapp_number', s.whatsapp_number,
    'support_enabled', s.support_enabled
  )
  from public.platform_support_settings s where s.id=1;
$$;
revoke all on function public.get_my_platform_access() from public;
grant execute on function public.get_my_platform_access() to authenticated;

-- create_workspace tambem valida no banco; esconder a tela no frontend nao e barreira de seguranca.
create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; clean_name text:=trim(workspace_name); clean_slug text:=lower(trim(workspace_slug));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.platform_user_access_allowed(auth.uid()) then raise exception 'Seu acesso ainda aguarda liberação da plataforma.'; end if;
  if char_length(clean_name)<2 or char_length(clean_name)>120 then raise exception 'invalid workspace name'; end if;
  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid workspace slug'; end if;
  insert into public.workspaces(name,slug,owner_user_id) values(clean_name,clean_slug,auth.uid()) returning id into new_id;
  insert into public.workspace_members(workspace_id,user_id,role,status) values(new_id,auth.uid(),'organizer_owner','active');
  insert into public.workspace_settings(workspace_id) values(new_id);
  insert into public.user_preferences(user_id,last_workspace_id) values(auth.uid(),new_id)
    on conflict(user_id) do update set last_workspace_id=excluded.last_workspace_id,updated_at=now();
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new_id,auth.uid(),'workspace.created','workspace',new_id::text,jsonb_build_object('name',clean_name,'slug',clean_slug));
  return new_id;
exception when unique_violation then raise exception 'workspace slug already in use';
end; $$;
revoke all on function public.create_workspace(text,text) from public;
grant execute on function public.create_workspace(text,text) to authenticated;

create table if not exists public.platform_support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  subject text not null default 'Liberação de acesso' check (char_length(subject) between 2 and 160),
  status text not null default 'open' check (status in ('open','closed')),
  master_last_read_at timestamptz,
  user_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.platform_support_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('user','master')),
  body text check (body is null or char_length(body) between 1 and 2000),
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);

create index if not exists platform_support_threads_last_idx on public.platform_support_threads(last_message_at desc);
create index if not exists platform_support_messages_thread_idx on public.platform_support_messages(thread_id,created_at);

alter table public.platform_support_settings enable row level security;
alter table public.platform_support_threads enable row level security;
alter table public.platform_support_messages enable row level security;

-- As tabelas sao consumidas apenas pelas RPCs abaixo. Nenhum acesso direto e necessario.
revoke all on public.platform_support_settings from anon,authenticated;
revoke all on public.platform_support_threads from anon,authenticated;
revoke all on public.platform_support_messages from anon,authenticated;

create or replace function public.support_get_or_create_thread()
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not coalesce((select support_enabled from public.platform_support_settings where id=1),true) then raise exception 'support disabled'; end if;
  insert into public.platform_support_threads(user_id,status,updated_at)
  values(auth.uid(),'open',now())
  on conflict(user_id) do update set status='open',updated_at=now()
  returning id into tid;
  return tid;
end; $$;
revoke all on function public.support_get_or_create_thread() from public;
grant execute on function public.support_get_or_create_thread() to authenticated;

create or replace function public.support_get_my_conversation()
returns jsonb language plpgsql security definer set search_path=public as $$
declare tid uuid; stat text; msgs jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select id,status into tid,stat from public.platform_support_threads where user_id=auth.uid();
  if tid is null then return jsonb_build_object('thread_id',null,'status',null,'messages','[]'::jsonb); end if;
  update public.platform_support_threads set user_last_read_at=now() where id=tid;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender_kind',m.sender_kind,'body',m.body,'attachment_path',m.attachment_path,'attachment_name',m.attachment_name,'created_at',m.created_at) order by m.created_at),'[]'::jsonb)
    into msgs from public.platform_support_messages m where m.thread_id=tid;
  return jsonb_build_object('thread_id',tid,'status',stat,'messages',msgs);
end; $$;
revoke all on function public.support_get_my_conversation() from public;
grant execute on function public.support_get_my_conversation() to authenticated;

create or replace function public.support_send_my_message(target_body text default null,target_attachment_path text default null,target_attachment_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; mid uuid; clean_body text:=nullif(trim(target_body),'');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if clean_body is null and target_attachment_path is null then raise exception 'empty message'; end if;
  tid:=public.support_get_or_create_thread();
  if target_attachment_path is not null and target_attachment_path not like auth.uid()::text||'/'||tid::text||'/%' then raise exception 'invalid attachment path'; end if;
  insert into public.platform_support_messages(thread_id,sender_user_id,sender_kind,body,attachment_path,attachment_name)
    values(tid,auth.uid(),'user',clean_body,target_attachment_path,nullif(trim(target_attachment_name),'')) returning id into mid;
  update public.platform_support_threads set status='open',last_message_at=now(),updated_at=now() where id=tid;
  return mid;
end; $$;
revoke all on function public.support_send_my_message(text,text,text) from public;
grant execute on function public.support_send_my_message(text,text,text) to authenticated;

create or replace function public.master_get_support_settings()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.is_platform_owner() then jsonb_build_object('blocked_title',blocked_title,'blocked_message',blocked_message,'whatsapp_number',whatsapp_number,'support_enabled',support_enabled) else null end
  from public.platform_support_settings where id=1;
$$;
revoke all on function public.master_get_support_settings() from public;
grant execute on function public.master_get_support_settings() to authenticated;

create or replace function public.master_update_support_settings(target_blocked_title text,target_blocked_message text,target_whatsapp_number text default null,target_support_enabled boolean default true)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if char_length(trim(target_blocked_title))<3 then raise exception 'invalid title'; end if;
  if char_length(trim(target_blocked_message))<10 then raise exception 'invalid message'; end if;
  update public.platform_support_settings set blocked_title=trim(target_blocked_title),blocked_message=trim(target_blocked_message),whatsapp_number=nullif(regexp_replace(coalesce(target_whatsapp_number,''),'[^0-9]','','g'),''),support_enabled=target_support_enabled,updated_by=auth.uid(),updated_at=now() where id=1;
  insert into public.platform_master_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'support.settings_updated',jsonb_build_object('support_enabled',target_support_enabled));
end; $$;
revoke all on function public.master_update_support_settings(text,text,text,boolean) from public;
grant execute on function public.master_update_support_settings(text,text,text,boolean) to authenticated;

create or replace function public.master_list_support_threads()
returns table(thread_id uuid,user_id uuid,email text,display_name text,status text,subject text,last_message_at timestamptz,unread_count bigint)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query select t.id,t.user_id,u.email::text,p.display_name,t.status,t.subject,t.last_message_at,
    (select count(*) from public.platform_support_messages m where m.thread_id=t.id and m.sender_kind='user' and m.created_at>coalesce(t.master_last_read_at,'epoch'::timestamptz))
  from public.platform_support_threads t left join auth.users u on u.id=t.user_id left join public.profiles p on p.id=t.user_id
  order by (select count(*) from public.platform_support_messages m where m.thread_id=t.id and m.sender_kind='user' and m.created_at>coalesce(t.master_last_read_at,'epoch'::timestamptz)) desc,t.last_message_at desc;
end; $$;
revoke all on function public.master_list_support_threads() from public;
grant execute on function public.master_list_support_threads() to authenticated;

create or replace function public.master_get_support_conversation(target_thread_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare stat text; msgs jsonb;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  select status into stat from public.platform_support_threads where id=target_thread_id;
  if stat is null then raise exception 'thread not found'; end if;
  update public.platform_support_threads set master_last_read_at=now() where id=target_thread_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender_kind',m.sender_kind,'body',m.body,'attachment_path',m.attachment_path,'attachment_name',m.attachment_name,'created_at',m.created_at) order by m.created_at),'[]'::jsonb)
    into msgs from public.platform_support_messages m where m.thread_id=target_thread_id;
  return jsonb_build_object('thread_id',target_thread_id,'status',stat,'messages',msgs);
end; $$;
revoke all on function public.master_get_support_conversation(uuid) from public;
grant execute on function public.master_get_support_conversation(uuid) to authenticated;

create or replace function public.master_send_support_message(target_thread_id uuid,target_body text default null,target_attachment_path text default null,target_attachment_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; target_user uuid; clean_body text:=nullif(trim(target_body),'');
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if clean_body is null and target_attachment_path is null then raise exception 'empty message'; end if;
  select user_id into target_user from public.platform_support_threads where id=target_thread_id;
  if target_user is null then raise exception 'thread not found'; end if;
  if target_attachment_path is not null and target_attachment_path not like target_user::text||'/'||target_thread_id::text||'/%' then raise exception 'invalid attachment path'; end if;
  insert into public.platform_support_messages(thread_id,sender_user_id,sender_kind,body,attachment_path,attachment_name)
    values(target_thread_id,auth.uid(),'master',clean_body,target_attachment_path,nullif(trim(target_attachment_name),'')) returning id into mid;
  update public.platform_support_threads set status='open',last_message_at=now(),updated_at=now(),master_last_read_at=now() where id=target_thread_id;
  return mid;
end; $$;
revoke all on function public.master_send_support_message(uuid,text,text,text) from public;
grant execute on function public.master_send_support_message(uuid,text,text,text) to authenticated;

create or replace function public.master_set_support_thread_status(target_thread_id uuid,target_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_status not in ('open','closed') then raise exception 'invalid support status'; end if;
  update public.platform_support_threads set status=target_status,updated_at=now() where id=target_thread_id;
  if not found then raise exception 'thread not found'; end if;
end; $$;
revoke all on function public.master_set_support_thread_status(uuid,text) from public;
grant execute on function public.master_set_support_thread_status(uuid,text) to authenticated;

-- Convites autorizados pelo organizador nao devem exigir compra adicional do vendedor/operador.
-- A liberacao automatica so remove o bloqueio inicial, nunca um bloqueio manual posterior do Master.
create or replace function public.accept_seller_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.seller_invitations%rowtype; current_email text; ev uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into i from public.seller_invitations where token=invite_token for update;
  if i.id is null then raise exception 'invite not found'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invite is no longer valid'; end if;
  if current_email is distinct from lower(i.email) then raise exception 'invite belongs to another email'; end if;
  if exists(select 1 from public.workspace_members where workspace_id=i.workspace_id and user_id=auth.uid() and role<>'seller') then raise exception 'this account already has an organizer role in this workspace'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,status) values(i.workspace_id,auth.uid(),'seller','active') on conflict(workspace_id,user_id) do update set role='seller',status='active',updated_at=now();
  foreach ev in array i.event_ids loop insert into public.event_seller_assignments(workspace_id,event_id,seller_user_id,is_active) values(i.workspace_id,ev,auth.uid(),true) on conflict(event_id,seller_user_id) do update set is_active=true,updated_at=now(); end loop;
  update public.seller_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  update public.platform_user_controls set access_status='active',reason=null,updated_at=now() where user_id=auth.uid() and access_status='suspended' and reason='Aguardando liberação comercial';
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(i.workspace_id,auth.uid(),'seller.invite_accepted','workspace_member',auth.uid()::text,jsonb_build_object('event_ids',i.event_ids));
  return i.workspace_id;
end; $$;
revoke all on function public.accept_seller_invitation(uuid) from public;
grant execute on function public.accept_seller_invitation(uuid) to authenticated;

create or replace function public.accept_draw_operator_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.draw_operator_invitations%rowtype;current_email text;ev uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into i from public.draw_operator_invitations where token=invite_token for update;
  if i.id is null then raise exception 'invite not found'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invite is no longer valid'; end if;
  if current_email is distinct from lower(i.email) then raise exception 'invite belongs to another email'; end if;
  if exists(select 1 from public.workspace_members where workspace_id=i.workspace_id and user_id=auth.uid() and role::text<>'draw_operator') then raise exception 'this account already has another role in this workspace'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,status) values(i.workspace_id,auth.uid(),'draw_operator','active') on conflict(workspace_id,user_id) do update set role='draw_operator',status='active',updated_at=now();
  foreach ev in array i.event_ids loop insert into public.event_draw_operator_assignments(workspace_id,event_id,operator_user_id,is_active) values(i.workspace_id,ev,auth.uid(),true) on conflict(event_id,operator_user_id) do update set is_active=true,updated_at=now(); end loop;
  update public.draw_operator_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  update public.platform_user_controls set access_status='active',reason=null,updated_at=now() where user_id=auth.uid() and access_status='suspended' and reason='Aguardando liberação comercial';
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(i.workspace_id,auth.uid(),'draw_operator.invite_accepted','workspace_member',auth.uid()::text,jsonb_build_object('event_ids',i.event_ids));
  return i.workspace_id;
end; $$;
revoke all on function public.accept_draw_operator_invitation(uuid) from public;
grant execute on function public.accept_draw_operator_invitation(uuid) to authenticated;

-- Bucket privado para comprovantes. A URL de download e temporaria (signed URL).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('platform-support','platform-support',false,8388608,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists platform_support_upload on storage.objects;
create policy platform_support_upload on storage.objects for insert to authenticated
with check(bucket_id='platform-support' and (public.is_platform_owner() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.platform_support_threads t where t.user_id=auth.uid() and t.id::text=(storage.foldername(name))[2]))));

drop policy if exists platform_support_read on storage.objects;
create policy platform_support_read on storage.objects for select to authenticated
using(bucket_id='platform-support' and (public.is_platform_owner() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.platform_support_threads t where t.user_id=auth.uid() and t.id::text=(storage.foldername(name))[2]))));

drop policy if exists platform_support_delete on storage.objects;
create policy platform_support_delete on storage.objects for delete to authenticated
using(bucket_id='platform-support' and public.is_platform_owner());

-- Todo novo organizador liberado comeca de forma conservadora com 1 evento.
-- O Master pode ampliar para qualquer plano/limite depois, sem janela de acesso ilimitado.
create or replace function public.attach_default_workspace_license()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.workspace_licenses(workspace_id,access_status,plan_code,event_limit)
  values(new.id,'active',case when exists(select 1 from public.commercial_plans where code='single_event') then 'single_event' else null end,1)
  on conflict(workspace_id) do nothing;
  return new;
end; $$;
