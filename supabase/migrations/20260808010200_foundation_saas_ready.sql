-- Fase 0 completa: metadados SaaS e bootstrap seguro de workspace.
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'paused', 'canceled');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status public.subscription_status not null default 'trial',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null,
  period_start date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, metric, period_start)
);

alter table public.plans enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;

create policy plans_read_authenticated on public.plans for select to authenticated using (is_active or public.is_platform_admin());
create policy workspace_settings_member_read on public.workspace_settings for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_settings_admin_write on public.workspace_settings for all to authenticated
using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));
create policy subscriptions_workspace_read on public.subscriptions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy usage_workspace_read on public.usage_counters for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.workspaces(name, slug, owner_user_id)
  values (trim(workspace_name), lower(trim(workspace_slug)), auth.uid()) returning id into new_id;
  insert into public.workspace_members(workspace_id, user_id, role, status)
  values (new_id, auth.uid(), 'organizer_owner', 'active');
  insert into public.workspace_settings(workspace_id) values (new_id);
  return new_id;
end;
$$;
revoke all on function public.create_workspace(text,text) from public;
grant execute on function public.create_workspace(text,text) to authenticated;

create index subscriptions_status_idx on public.subscriptions(status);
create index usage_counters_metric_idx on public.usage_counters(metric, period_start);

create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger workspace_settings_set_updated_at before update on public.workspace_settings for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
