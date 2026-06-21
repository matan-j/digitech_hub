-- 018_content_access_model.sql
-- Public-first access model + SAFE (additive) metadata/body separation.
--
-- DESIGN RULES (non-negotiable):
--   * Additive only. We DO NOT drop or rename any existing column.
--   * Legacy body columns (content_items.body/video_url/content_url,
--     lessons.body/vimeo_id, playbooks.html_content) are KEPT and remain the
--     source of truth until live verification is approved. The new *_bodies
--     tables are populated by backfill and kept in sync; reads can dual-source
--     during the transition.
--   * No data is destroyed; backfill is copy-only.
--   * RLS for the new columns/tables is defined in 022_rls_visibility.sql.
--
-- Access semantics (enforced in app + RLS):
--   access_level = open                  -> full content public; login only for
--                                            high-intent actions (progress, save,
--                                            download, workspace).
--   access_level = login_required        -> metadata public; full body needs login;
--                                            preview public iff preview_enabled.
--   access_level = purchase_required     -> metadata public; full body needs an
--                                            active entitlement; preview iff enabled.
--   access_level = subscription_required -> metadata public; full body needs a
--                                            legacy active Stripe subscription (or a
--                                            future subscription entitlement);
--                                            preview iff enabled.
--   catalog_visibility = public|unlisted -> controls listing/discovery only.

-- ============================================================
-- 1. content_items — access columns + archived status
-- ============================================================

alter table public.content_items
  add column if not exists catalog_visibility text not null default 'public',
  add column if not exists access_level text not null default 'open',
  add column if not exists preview_enabled boolean not null default false,
  add column if not exists price_amount numeric(10,2),
  add column if not exists price_currency text not null default 'ILS';

alter table public.content_items
  drop constraint if exists content_items_catalog_visibility_check;
alter table public.content_items
  add constraint content_items_catalog_visibility_check
  check (catalog_visibility in ('public','unlisted'));

alter table public.content_items
  drop constraint if exists content_items_access_level_check;
alter table public.content_items
  add constraint content_items_access_level_check
  check (access_level in ('open','login_required','purchase_required','subscription_required'));

-- Allow 'archived' as a publication_status value (status column == publication_status).
alter table public.content_items
  drop constraint if exists content_items_status_check;
alter table public.content_items
  add constraint content_items_status_check
  check (status in ('draft','published','archived'));

-- ============================================================
-- 2. playbooks — same access columns + archived status
-- ============================================================

alter table public.playbooks
  add column if not exists catalog_visibility text not null default 'public',
  add column if not exists access_level text not null default 'open',
  add column if not exists preview_enabled boolean not null default false;

alter table public.playbooks
  drop constraint if exists playbooks_catalog_visibility_check;
alter table public.playbooks
  add constraint playbooks_catalog_visibility_check
  check (catalog_visibility in ('public','unlisted'));

alter table public.playbooks
  drop constraint if exists playbooks_access_level_check;
alter table public.playbooks
  add constraint playbooks_access_level_check
  check (access_level in ('open','login_required','purchase_required','subscription_required'));

alter table public.playbooks
  drop constraint if exists playbooks_status_check;
alter table public.playbooks
  add constraint playbooks_status_check
  check (status in ('draft','published','archived'));

-- ============================================================
-- 3. playlists — catalog_visibility + archived status
-- ============================================================

alter table public.playlists
  add column if not exists catalog_visibility text not null default 'public';

alter table public.playlists
  drop constraint if exists playlists_catalog_visibility_check;
alter table public.playlists
  add constraint playlists_catalog_visibility_check
  check (catalog_visibility in ('public','unlisted'));

alter table public.playlists
  drop constraint if exists playlists_status_check;
alter table public.playlists
  add constraint playlists_status_check
  check (status in ('draft','published','archived'));

-- ============================================================
-- 4. lessons — per-lesson preview flag
-- ============================================================

alter table public.lessons
  add column if not exists is_preview boolean not null default false;

-- ============================================================
-- 5. Backfill access_level from legacy is_premium
--    is_premium=true  -> subscription_required (legacy Stripe all-access path)
--    is_premium=false -> open
--    catalog_visibility stays 'public' so premium items become publicly
--    discoverable (metadata only) once 022 RLS lands.
-- ============================================================

update public.content_items
  set access_level = case when is_premium then 'subscription_required' else 'open' end
  where access_level = 'open';  -- only touch rows still at the default

update public.playbooks
  set access_level = case when is_premium then 'subscription_required' else 'open' end
  where access_level = 'open';

-- ============================================================
-- 6. Protected body child tables (metadata stays on parent; body moves here)
--    Created and backfilled, but legacy columns are KEPT. RLS in 022.
-- ============================================================

create table if not exists public.content_bodies (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  body jsonb,
  video_url text,
  content_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_bodies (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  body text,
  vimeo_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.playbook_bodies (
  playbook_id uuid primary key references public.playbooks(id) on delete cascade,
  html_content text,
  updated_at timestamptz not null default now()
);

-- Backfill (copy-only, idempotent via ON CONFLICT DO NOTHING).
insert into public.content_bodies (content_item_id, body, video_url, content_url)
  select id, body, video_url, content_url from public.content_items
  on conflict (content_item_id) do nothing;

insert into public.lesson_bodies (lesson_id, body, vimeo_id)
  select id, body, vimeo_id from public.lessons
  on conflict (lesson_id) do nothing;

insert into public.playbook_bodies (playbook_id, html_content)
  select id, html_content from public.playbooks
  on conflict (playbook_id) do nothing;

-- ============================================================
-- 7. Reconciliation — run AFTER apply; all three must return 0 mismatches.
--    (Kept as comments so the migration itself is side-effect free here.)
-- ============================================================
-- select
--   (select count(*) from public.content_items) as items,
--   (select count(*) from public.content_bodies) as bodies,
--   (select count(*) from public.content_items ci
--      left join public.content_bodies cb on cb.content_item_id = ci.id
--      where cb.content_item_id is null) as missing_bodies,
--   (select count(*) from public.content_items where video_url is not null) as items_with_video,
--   (select count(*) from public.content_bodies where video_url is not null) as bodies_with_video;
--
-- select
--   (select count(*) from public.lessons) as lessons,
--   (select count(*) from public.lesson_bodies) as lesson_bodies,
--   (select count(*) from public.lessons l
--      left join public.lesson_bodies lb on lb.lesson_id = l.id
--      where lb.lesson_id is null) as missing_lesson_bodies;
--
-- select
--   (select count(*) from public.playbooks) as playbooks,
--   (select count(*) from public.playbook_bodies) as playbook_bodies,
--   (select count(*) from public.playbooks p
--      left join public.playbook_bodies pb on pb.playbook_id = p.id
--      where pb.playbook_id is null) as missing_playbook_bodies;
