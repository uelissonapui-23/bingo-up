-- Remove politicas ALL que duplicavam SELECT e bloqueia escrita direta nos historicos.
do $$ declare t text; begin foreach t in array array['raffle_configs','raffle_tickets','symbol_bingo_configs','symbol_bingo_items'] loop
  execute format('drop policy if exists %I on public.%I',t||'_manage',t);
  execute format('drop policy if exists %I on public.%I',t||'_insert',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_update',t);
  execute format('create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_update',t);
  execute format('drop policy if exists %I on public.%I',t||'_delete',t);
  execute format('create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_delete',t);
end loop; end $$;
revoke insert,update,delete on public.raffle_draws,public.symbol_bingo_draws from authenticated;
