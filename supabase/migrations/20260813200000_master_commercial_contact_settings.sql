-- Separa contatos comerciais do suporte operacional da plataforma.
alter table public.platform_support_settings
  add column if not exists sales_whatsapp_number text,
  add column if not exists support_phone text,
  add column if not exists sales_whatsapp_message text;

update public.platform_support_settings
set sales_whatsapp_message = coalesce(nullif(trim(sales_whatsapp_message),''),'Olá! Quero conhecer os planos do BINGOUP e contratar acesso.')
where id=1;

create or replace function public.master_get_support_settings()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.is_platform_owner() then jsonb_build_object(
    'blocked_title',blocked_title,
    'blocked_message',blocked_message,
    'whatsapp_number',whatsapp_number,
    'sales_whatsapp_number',sales_whatsapp_number,
    'support_phone',support_phone,
    'sales_whatsapp_message',sales_whatsapp_message,
    'support_enabled',support_enabled
  ) else null end
  from public.platform_support_settings where id=1;
$$;
revoke all on function public.master_get_support_settings() from public;
grant execute on function public.master_get_support_settings() to authenticated;

create or replace function public.master_update_support_settings(
  target_blocked_title text,
  target_blocked_message text,
  target_whatsapp_number text default null,
  target_sales_whatsapp_number text default null,
  target_support_phone text default null,
  target_sales_whatsapp_message text default null,
  target_support_enabled boolean default true
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'access denied'; end if;
  if length(trim(coalesce(target_blocked_title,''))) < 3 then raise exception 'invalid title'; end if;
  if length(trim(coalesce(target_blocked_message,''))) < 10 then raise exception 'invalid message'; end if;
  update public.platform_support_settings
  set blocked_title=trim(target_blocked_title),
      blocked_message=trim(target_blocked_message),
      whatsapp_number=nullif(regexp_replace(coalesce(target_whatsapp_number,''),'[^0-9]','','g'),''),
      sales_whatsapp_number=nullif(regexp_replace(coalesce(target_sales_whatsapp_number,''),'[^0-9]','','g'),''),
      support_phone=nullif(trim(coalesce(target_support_phone,'')),''),
      sales_whatsapp_message=nullif(trim(coalesce(target_sales_whatsapp_message,'')),''),
      support_enabled=target_support_enabled,
      updated_by=auth.uid(),updated_at=now()
  where id=1;
end $$;
revoke all on function public.master_update_support_settings(text,text,text,text,text,text,boolean) from public;
grant execute on function public.master_update_support_settings(text,text,text,text,text,text,boolean) to authenticated;

-- Site público recebe somente contatos intencionalmente públicos.
create or replace function public.get_public_marketing_data()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'whatsapp_number',(select coalesce(sales_whatsapp_number,whatsapp_number) from public.platform_support_settings where id=1),
    'whatsapp_message',(select sales_whatsapp_message from public.platform_support_settings where id=1),
    'support_phone',(select support_phone from public.platform_support_settings where id=1),
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
