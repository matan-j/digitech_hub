-- 045_popup_image_link_auth.sql
-- Adds an "open the registration/login modal on click" action for popup images.
--
-- DESIGN:
--   * `image_link_auth` (boolean): when true, clicking the popup image opens the
--     site's registration/login modal (AccessModal) instead of navigating to a
--     URL. The public renderer only wires the click for *logged-out* visitors —
--     a logged-in user sees a plain, non-clickable image.
--   * When `image_link_auth` is true the URL in `image_link` is ignored (the
--     auth action takes precedence), so the admin form treats them as a choice.
--
-- No RLS change — additive column only.
--   Run this in the Supabase SQL editor.

alter table public.popups
  add column if not exists image_link_auth boolean not null default false;
