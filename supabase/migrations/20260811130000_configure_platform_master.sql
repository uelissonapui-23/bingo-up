DO $$
DECLARE
  master_user_id uuid;
BEGIN
  SELECT id
    INTO master_user_id
  FROM auth.users
  WHERE lower(email) = lower('evoriagerenciamentodeeventos@gmail.com')
  LIMIT 1;

  IF master_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta Master nao encontrada no Supabase Auth: evoriagerenciamentodeeventos@gmail.com';
  END IF;

  INSERT INTO public.platform_members (
    user_id,
    role
  )
  VALUES (
    master_user_id,
    'platform_owner'::public.platform_role
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = 'platform_owner'::public.platform_role;
END
$$;
