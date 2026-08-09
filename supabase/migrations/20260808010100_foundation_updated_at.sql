create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
