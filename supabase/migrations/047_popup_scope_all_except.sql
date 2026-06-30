-- 047_popup_scope_all_except.sql
-- Adds an "all pages except…" targeting mode for popups.
--
-- DESIGN:
--   * New scope value `all_except`: the popup shows site-wide EXCEPT on the
--     paths listed in `excluded_paths`.
--   * `excluded_paths` (text[]): the paths to exclude when scope = 'all_except'.
--   * The existing `target_path` (single) still backs scope = 'page'.
--   * Path matching for all scopes now happens in the API layer
--     (getActivePopupsForPath) — this migration only widens the data model.
--
-- No RLS change — additive column + relaxed CHECK constraint.
--   Run this in the Supabase SQL editor.

alter table public.popups
  add column if not exists excluded_paths text[] not null default '{}';

alter table public.popups
  drop constraint if exists popups_scope_check;

alter table public.popups
  add constraint popups_scope_check
  check (scope in ('all', 'page', 'all_except'));
