-- 028_email_auth_providers.sql
-- Cross-provider signup guard.
--
-- PROBLEM
--   A person can register the same email twice under different methods —
--   e.g. email+password first, then "Continue with Google" (or the reverse).
--   If Supabase does NOT auto-link them (the original account was never
--   confirmed, or linking is off), a SECOND auth.users row is created and
--   handle_new_user() makes a FRESH empty profile. The user is now signed into a
--   new account and their purchases / entitlements appear to have vanished. The
--   old row is not overwritten, but the user effectively LOSES their account.
--
-- FIX
--   Let the app look up which providers already exist for an email BEFORE it
--   creates a second account, so the signup forms can block and steer the user
--   back to their original method instead of minting a duplicate.
--
-- SECURITY
--   SECURITY DEFINER — needed to read auth.users / auth.identities, which are not
--   exposed through PostgREST. EXECUTE is granted to service_role ONLY (never
--   anon / authenticated), so email existence is not enumerable from the
--   browser. The sole caller is the trusted /api/auth/check-email route, which
--   runs with the service key.
--   Idempotent — safe to re-run.

create or replace function public.email_auth_providers(p_email text)
returns text[]
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(distinct i.provider), '{}')
  from auth.users u
  join auth.identities i on i.user_id = u.id
  where lower(u.email) = lower(trim(p_email));
$$;

-- Lock it down: trusted server contexts only.
revoke all on function public.email_auth_providers(text) from public;
revoke all on function public.email_auth_providers(text) from anon, authenticated;
grant execute on function public.email_auth_providers(text) to service_role;
