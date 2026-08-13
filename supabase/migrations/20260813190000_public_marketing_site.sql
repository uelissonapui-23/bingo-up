-- Site público de apresentação comercial do BINGOUP.
-- Expõe somente dados comerciais intencionalmente públicos: planos ativos e WhatsApp de atendimento.
create or replace function public.get_public_marketing_data()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'whatsapp_number',(select whatsapp_number from public.platform_support_settings where id=1),
    'plans',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',p.code,'name',p.name,'description',p.description,'event_limit',p.event_limit,
        'price_cents',p.price_cents,'billing_label',p.billing_label
      ) order by p.sort_order,p.name)
      from public.commercial_plans p where p.is_active
    ),'[]'::jsonb)
  );
$$;
revoke all on function public.get_public_marketing_data() from public;
grant execute on function public.get_public_marketing_data() to anon,authenticated;
