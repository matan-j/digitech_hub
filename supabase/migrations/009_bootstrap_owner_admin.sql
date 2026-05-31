-- 009_bootstrap_owner_admin.sql
-- Auto-promote the Digitech owner (office@digi-tech.co.il) to admin.
-- Idempotent: safe to re-run; updates existing profile and patches the trigger.

-- 1. Backfill: if the owner has already signed up before this migration ran,
--    upgrade their existing profile to admin in place.
update public.profiles
set role = 'admin'
where id in (
  select id from auth.users where email = 'office@digi-tech.co.il'
);

-- 2. Patch the new-user trigger so future signups with the owner email
--    are created as admin in a single insert (no second update needed).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := 'subscriber';
begin
  if new.email = 'office@digi-tech.co.il' then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', v_role);
  return new;
end;
$$;
