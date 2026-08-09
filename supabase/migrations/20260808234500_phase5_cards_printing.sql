-- Fase 5: consulta, impressão, auditoria de impressão e anulação segura de cartelas.
-- Mantém a emissão imutável e prepara o mesmo registro para vendas e cartela digital.

alter table public.physical_cards
  add column if not exists first_printed_at timestamptz,
  add column if not exists last_printed_at timestamptz,
  add column if not exists print_count integer not null default 0 check (print_count >= 0),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

create table if not exists public.card_print_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  batch_id uuid not null references public.card_batches(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  card_count integer not null check (card_count > 0),
  card_ids uuid[] not null,
  created_at timestamptz not null default now()
);
create index if not exists card_print_jobs_event_idx on public.card_print_jobs(workspace_id,event_id,created_at desc);
alter table public.card_print_jobs enable row level security;
create policy card_print_jobs_member_select on public.card_print_jobs for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.register_card_print(target_batch_id uuid,target_card_ids uuid[]) returns uuid
language plpgsql security definer set search_path=public as $$
declare b public.card_batches%rowtype; job_id uuid; valid_count integer;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into b from public.card_batches where id=target_batch_id;
 if b.id is null or b.status<>'completed' then raise exception 'completed batch required'; end if;
 if not public.has_workspace_role(b.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 select count(*) into valid_count from public.physical_cards where batch_id=b.id and id=any(target_card_ids) and status<>'void';
 if valid_count<>cardinality(target_card_ids) or valid_count=0 then raise exception 'invalid card selection'; end if;
 insert into public.card_print_jobs(workspace_id,event_id,batch_id,card_count,card_ids) values(b.workspace_id,b.event_id,b.id,valid_count,target_card_ids) returning id into job_id;
 update public.physical_cards set first_printed_at=coalesce(first_printed_at,now()),last_printed_at=now(),print_count=print_count+1 where id=any(target_card_ids);
 perform public.log_audit(b.workspace_id,'cards.printed','card_batch',b.id::text,jsonb_build_object('print_job_id',job_id,'card_count',valid_count));
 return job_id;
end; $$;
revoke all on function public.register_card_print(uuid,uuid[]) from public;
grant execute on function public.register_card_print(uuid,uuid[]) to authenticated;

create or replace function public.void_physical_card(target_card_id uuid,reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare c public.physical_cards%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into c from public.physical_cards where id=target_card_id for update;
 if c.id is null then raise exception 'card not found'; end if;
 if not public.has_workspace_role(c.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if c.status<>'available' then raise exception 'only available cards can be voided'; end if;
 update public.physical_cards set status='void',voided_at=now(),voided_by=auth.uid(),void_reason=left(nullif(trim(reason),''),500) where id=c.id;
 perform public.log_audit(c.workspace_id,'card.voided','physical_card',c.id::text,jsonb_build_object('event_id',c.event_id,'code',c.code,'reason',reason));
end; $$;
revoke all on function public.void_physical_card(uuid,text) from public;
grant execute on function public.void_physical_card(uuid,text) to authenticated;

-- Não existe UPDATE direto em números, assinatura, lote ou regra da cartela. As únicas mutações
-- operacionais desta fase passam pelas RPCs acima. Isso preserva a correspondência entre papel e banco.
