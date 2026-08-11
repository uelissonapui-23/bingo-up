-- NÃO é executado pelo `supabase db push` de propósito.
-- Segurança: substitua o e-mail abaixo pela ÚNICA conta que deve acessar /master e execute no SQL Editor do Supabase.
-- A conta precisa já existir em Authentication > Users.

insert into public.platform_members(user_id, role)
select id, 'platform_owner'::public.platform_role
from auth.users
where lower(email)=lower('evoriagerenciamentodeeventos@gmail.com')
on conflict(user_id) do update set role='platform_owner'::public.platform_role;

-- Verificação opcional:
select u.email, pm.role from public.platform_members pm join auth.users u on u.id=pm.user_id where pm.role='platform_owner';
