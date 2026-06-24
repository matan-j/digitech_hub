-- 027_skip_oauth_name_import.sql
-- Do NOT import the provider-supplied name for OAuth (Google) signups.
--
-- WHY
--   The app requires a Hebrew full name entered through our own forms (signup
--   field / completion popup), validated to "2 Hebrew words, ≥2 letters each".
--   Google supplies a display name (often Latin, e.g. "Or Eldebah") that must
--   NOT be adopted as the user's name — a Google user re-enters it from scratch.
--
-- WHAT
--   handle_new_user() previously copied raw_user_meta_data->>'full_name' for
--   every provider. Now it only does so for the email path (password +
--   magic-link), where full_name is the value our forms pass and is already
--   validated. For OAuth signups full_name starts NULL, so the completion popup
--   opens empty and the user types a Hebrew name.
--
--   Returning Google users who later saved a Hebrew name through our forms are
--   unaffected — their stored name is theirs, not Google's, and is not touched.
--
-- SAFETY
--   Replaces the function body only; the trigger binding is unchanged.
--   Idempotent. Existing rows are not modified.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    case
      when coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email'
        then new.raw_user_meta_data->>'full_name'
      else null
    end
  );
  return new;
end;
$$;
