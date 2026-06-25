-- 036_bundles.sql
-- "Bundle" product type: a sellable content_items row (type='bundle') that
-- grants access to a FIXED set of courses once it is purchased.
--
-- WHY content_items (not a new table):
--   A bundle reuses the ENTIRE content_items pipeline for free — pricing
--   (price_amount / sale_amount / price_currency), access_level, slug, publish,
--   catalog visibility, and coupons (coupon_products already accepts
--   content_type='bundle'). The ONLY bundle-specific data is which courses it
--   contains → that lives in bundle_items below.
--
-- HOW ACCESS FLOWS:
--   On a PAID bundle order, the GROW webhook (payment-success/route.ts) and the
--   free-purchase path both call grantPurchaseAccess(), which expands the
--   bundle's bundle_items and grants one 'course' entitlement per included
--   course. Access then "just works" through the existing has_content_access()
--   checks (019 / 032 / 034) — no RLS changes to the course-gating functions.
--
-- Additive only. No drops/renames of data.
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Safe to apply after 002 (content_items) and 019 (entitlements).

-- ============================================================
-- 1. Allow 'bundle' as a content_items.type
-- ============================================================
-- Migration 002 created the type check inline → it is auto-named
-- content_items_type_check. Drop + re-add it widened to include 'bundle'.

alter table public.content_items drop constraint if exists content_items_type_check;
alter table public.content_items
  add constraint content_items_type_check check (type in ('course','guide','bundle'));

-- ============================================================
-- 2. bundle_items — the courses contained in a bundle (ordered)
-- ============================================================
-- Both ids point at content_items: bundle_id → the type='bundle' row,
-- course_id → a type='course' row. on delete cascade keeps the mapping clean
-- when either the bundle or a course is removed.

create table if not exists public.bundle_items (
  bundle_id uuid not null references public.content_items(id) on delete cascade,
  course_id uuid not null references public.content_items(id) on delete cascade,
  position int not null default 0,
  primary key (bundle_id, course_id)
);

create index if not exists bundle_items_bundle_idx on public.bundle_items(bundle_id);

-- ============================================================
-- 3. RLS
-- ============================================================
-- Admins manage the mapping. WHICH courses sit in a bundle is not sensitive
-- (it is shown on the public product/purchase card), so it is publicly
-- readable. The purchase webhook reads it via the service client (bypasses RLS).

alter table public.bundle_items enable row level security;

create policy "bundle_items_admin_write"
  on public.bundle_items for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "bundle_items_public_read"
  on public.bundle_items for select
  using (true);
