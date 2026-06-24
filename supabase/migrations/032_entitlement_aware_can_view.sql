-- 032_entitlement_aware_can_view.sql
-- Fix: paid users get 404 on lesson pages because the base lessons/modules/
-- chapters tables are gated by can_view_content_item(), which was NEVER updated
-- for the purchase/entitlement model (migrations 018–024).
--
-- THE BUG:
--   can_view_content_item() (migration 005) still uses the LEGACY check:
--     is_admin() OR (published AND (is_premium = false OR has_premium_access()))
--   It ignores access_level='purchase_required' and ignores entitlements.
--   Meanwhile migration 022 made content_items + *_bodies entitlement-aware via
--   has_content_access(). The two drifted apart:
--     * purchase_required + is_premium=true  → a paying (non-subscriber) buyer
--       sees the course row (has_content_access honours the entitlement) but the
--       lessons/modules rows stay HIDDEN (can_view_content_item demands premium)
--       → empty course → getLesson() returns null → 404.
--     * purchase_required + is_premium=false → lessons leak to NON-buyers
--       (can_view_content_item returns true for everyone).
--
-- THE FIX:
--   Redefine can_view_content_item() to delegate to has_content_access(), the
--   single source of truth that already mirrors lib/learn/access.ts#decideAccess
--   (open / login_required / purchase_required=entitlement / subscription=premium,
--   plus admin + owning-creator). All policies that call can_view_content_item
--   (lessons, modules, chapters, resources, playbooks, video taxonomy) become
--   entitlement-aware consistently, with no behaviour change for open /
--   subscription_required / admin / creator paths.
--
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Safe to apply after 019 (defines has_content_access) and 018 (access_level).

create or replace function public.can_view_content_item(item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_content_access(item_id);
$$;
