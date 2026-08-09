-- Seed intencionalmente mínimo. Dados reais são criados pelo fluxo autenticado.
-- Planos são infraestrutura futura e podem permanecer inativos no MVP.
insert into public.plans(code, name, is_active, limits, features)
values ('internal', 'Uso interno', true, '{"events": null}'::jsonb, '{"sellers": false, "multi_organizer": false}'::jsonb)
on conflict (code) do nothing;
