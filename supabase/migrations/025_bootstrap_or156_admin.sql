-- 025_bootstrap_or156_admin.sql
-- Extend the owner-admin bootstrap to include or15603@gmail.com alongside
-- office@digi-tech.co.il and matan@digi-tech.co.il. Idempotent.

-- 1. Backfill: promote the existing profile to admin in place if the user
--    has already signed up.
update public.profiles
set role = 'admin'
where id in (
  select id from auth.users
  where email in (
    'office@digi-tech.co.il',
    'matan@digi-tech.co.il',
    'or15603@gmail.com'
  )
);

-- 2. Patch the new-user trigger so future signups with any owner-admin email
--    are created as admin in a single insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := 'subscriber';
begin
  if new.email in (
    'office@digi-tech.co.il',
    'matan@digi-tech.co.il',
    'or15603@gmail.com'
  ) then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', v_role);
  return new;
end;
$$;
