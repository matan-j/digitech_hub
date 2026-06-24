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

-- DROP first: an earlier revision returned text[]; CREATE OR REPLACE cannot
-- change a function's return type, so we drop and recreate. Idempotent.
drop function if exists public.email_auth_providers(text);

-- Returns { "providers": ["email","google",...], "has_password": bool }.
--   providers     — distinct auth providers linked to the email (one account may
--                   have several; 'email' covers BOTH password and OTP/magic-link
--                   identities, so it does NOT by itself imply a password).
--   has_password  — whether a real password is set (encrypted_password present).
--                   This is the only reliable "can log in with a password" signal;
--                   the 'email' provider alone is not.
create or replace function public.email_auth_providers(p_email text)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'providers',
      coalesce(array_agg(distinct i.provider), array[]::text[]),
    'has_password',
      coalesce(bool_or(u.encrypted_password is not null
                       and length(u.encrypted_password) > 0), false)
  )
  from auth.users u
  join auth.identities i on i.user_id = u.id
  where lower(u.email) = lower(trim(p_email));
$$;

-- Lock it down: trusted server contexts only.
revoke all on function public.email_auth_providers(text) from public;
revoke all on function public.email_auth_providers(text) from anon, authenticated;
grant execute on function public.email_auth_providers(text) to service_role;
