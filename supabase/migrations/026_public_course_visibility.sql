-- 026_public_course_visibility.sql
-- Fix: published premium/paid courses were invisible to guests.
--
-- ROOT CAUSE
--   The content_items base-table RLS (005 / 022) hides the WHOLE row for an item
--   that an anon viewer can't fully access. For a premium/paid published course
--   that means even the metadata (title, price, lesson titles) is hidden, so the
--   course vanishes from the catalog instead of showing locked. Desired model:
--   metadata is public for every PUBLISHED item; only the body/video is gated.
--
--   Migration 022/024 already built `content_items_public` for exactly this, but
--   the app never read from it, and there were no metadata views for the course
--   structure (modules/chapters/lessons). This migration adds them.
--
-- SAFETY
--   Additive only. `security_invoker = false` → the views run with the owner's
--   privileges and bypass base-table RLS, but they expose METADATA COLUMNS ONLY
--   (no body, no vimeo_id, no content/video URLs). Gated content stays gated:
--   the lesson player still reads bodies from the RLS-protected base tables.
--   Idempotent — safe to (re-)run regardless of whether 022/024 were applied.

-- ============================================================
-- 0. Ensure sale_amount exists (normally added in 024). Idempotent — makes this
--    migration self-sufficient if 024 was not applied to this database.
-- ============================================================
alter table public.content_items
  add column if not exists sale_amount numeric(10,2);

-- ============================================================
-- 1. content_items_public — metadata for every published item (re-affirm 024)
--    Body / video_url / content_url are intentionally excluded.
--    DROP+CREATE (not REPLACE): if the live DB still has the 022 column order
--    (no sale_amount), a CREATE OR REPLACE would fail on the mid-list insert.
-- ============================================================
drop view if exists public.content_items_public;
create view public.content_items_public
with (security_invoker = false) as
  select
    ci.id, ci.type, ci.slug, ci.title, ci.tagline, ci.description,
    ci.cover_url, ci.cover_style, ci.audience, ci.tags, ci.domain,
    ci.duration_minutes, ci.creator_id, ci.content_kind, ci.is_featured,
    ci.seo_title, ci.seo_description, ci.og_image_url,
    ci.access_level, ci.catalog_visibility, ci.preview_enabled,
    ci.price_amount, ci.sale_amount, ci.price_currency, ci.is_premium,
    ci.status, ci.published_at, ci.created_at, ci.updated_at
  from public.content_items ci
  where ci.status = 'published';

-- ============================================================
-- 2. modules_public — module metadata for published courses
--    Excludes body + vimeo_id (those are gated content).
-- ============================================================
create or replace view public.modules_public
with (security_invoker = false) as
  select
    m.id, m.course_id, m.num, m.slug, m.title, m.duration,
    m.position, m.created_at
  from public.modules m
  join public.content_items ci on ci.id = m.course_id
  where ci.status = 'published' and ci.type = 'course';

-- ============================================================
-- 3. chapters_public — chapter metadata for published courses
-- ============================================================
create or replace view public.chapters_public
with (security_invoker = false) as
  select
    c.id, c.module_id, c.num, c.slug, c.title, c.duration,
    c.position, c.created_at
  from public.chapters c
  join public.modules m on m.id = c.module_id
  join public.content_items ci on ci.id = m.course_id
  where ci.status = 'published';

-- ============================================================
-- 4. lessons_public — lesson metadata for published courses
--    Excludes body + vimeo_id; the player reads those from the gated base table.
-- ============================================================
create or replace view public.lessons_public
with (security_invoker = false) as
  select
    l.id, l.course_id, l.module_id, l.chapter_id, l.num, l.slug,
    l.title, l.duration, l.position, l.is_preview
  from public.lessons l
  join public.content_items ci on ci.id = l.course_id
  where ci.status = 'published';

-- ============================================================
-- 5. Grants — anonymous + authenticated may read public metadata
-- ============================================================
grant select on public.content_items_public to anon, authenticated;
grant select on public.modules_public        to anon, authenticated;
grant select on public.chapters_public       to anon, authenticated;
grant select on public.lessons_public        to anon, authenticated;
