-- 040_popups.sql
-- Admin-authored site popups (modals) with display conditions + scheduling.
--
-- DESIGN RULES (consistent with 039 / 008):
--   * One `popups` table holds the content (image / html / iframe / video /
--     rich_text), the display conditions (scroll % or time, whole-site or a
--     specific path), the per-user gates (logged-in only, show-once, enabled),
--     the look (corner radius, max width) and the scheduling window.
--   * A dedicated public storage bucket `popups` holds uploaded images
--     (admin-only writes, world-readable) — mirrors `brand` from 008.
--   * RLS: anyone may read *enabled* popups (the public renderer needs them);
--     admins may read/write everything. The public API filters the schedule
--     window + logged-in gate server-side; this policy is just the floor.
--
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Run this in the Supabase SQL editor.

-- ============================================================
-- 1. popups — the popup definition (admin-authored)
-- ============================================================

create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),

  -- internal admin label (not shown to visitors)
  name text not null,

  -- content
  content_type text not null default 'image'
    check (content_type in ('image', 'html', 'iframe', 'video', 'rich_text')),
  image_url text,                         -- content_type = image
  image_link text,                        -- optional: makes the whole image clickable
  image_link_new_tab boolean not null default true,
  html text,                              -- content_type = html OR rich_text
  iframe_url text,                        -- content_type = iframe
  video_url text,                         -- content_type = video (YouTube/Vimeo/mp4 url)

  -- per-user gates
  logged_in_only boolean not null default false,
  show_once boolean not null default false,   -- once per browser (localStorage)
  enabled boolean not null default false,

  -- look
  corner_radius int not null default 16 check (corner_radius between 0 and 64),
  max_width int not null default 480 check (max_width between 240 and 1280),

  -- display trigger
  trigger_type text not null default 'time'
    check (trigger_type in ('scroll', 'time')),
  trigger_value int not null default 5 check (trigger_value >= 0),  -- seconds (time) or percent (scroll)

  -- targeting
  scope text not null default 'all' check (scope in ('all', 'page')),
  target_path text,                       -- required when scope = 'page' (e.g. /learn)

  -- when several popups match a page, the highest priority wins
  priority int not null default 0,

  -- scheduling window (null = open-ended on that side)
  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists popups_enabled_idx on public.popups(enabled);
create index if not exists popups_scope_idx on public.popups(scope, target_path);

drop trigger if exists popups_set_updated_at on public.popups;
create trigger popups_set_updated_at
  before update on public.popups
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. RLS — enabled popups are world-readable; admins do everything.
-- ============================================================

alter table public.popups enable row level security;

drop policy if exists "popups_select_enabled" on public.popups;
create policy "popups_select_enabled"
  on public.popups for select
  using (enabled = true or public.is_admin());

drop policy if exists "popups_admin_write" on public.popups;
create policy "popups_admin_write"
  on public.popups for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 3. Storage bucket for uploaded popup images.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'popups',
  'popups',
  true,
  5 * 1024 * 1024,  -- 5 MB cap
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

drop policy if exists "popups_public_read" on storage.objects;
create policy "popups_public_read"
  on storage.objects for select
  using (bucket_id = 'popups');

drop policy if exists "popups_admin_write_storage" on storage.objects;
create policy "popups_admin_write_storage"
  on storage.objects for all
  using (bucket_id = 'popups' and public.is_admin())
  with check (bucket_id = 'popups' and public.is_admin());
