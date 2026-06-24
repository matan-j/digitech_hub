-- 023_homepage_config.sql
-- Homepage Studio — single-row config that drives the public homepage layout.
-- An admin composes the homepage from an ordered array of section objects
-- (hero, value props, featured courses/guides/creators/playlists, CTA band).
--
-- Follows the brand_settings singleton convention (010): id = 1, public read,
-- admin-only write, updated_at trigger. The app falls back to code-defined
-- DEFAULT_SECTIONS (lib/learn/homepage.ts) whenever `sections` is empty, so the
-- homepage renders correctly even before an admin ever opens the Studio.

create table if not exists public.homepage_config (
  id smallint primary key default 1,
  -- Ordered array of section objects:
  --   { key, type, enabled, title?, subtitle?, cta_label?, cta_href?, limit? }
  sections jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint homepage_config_single_row check (id = 1)
);

-- Seed the single row (empty sections → app uses DEFAULT_SECTIONS until saved).
insert into public.homepage_config (id) values (1) on conflict do nothing;

-- Keep updated_at fresh on every change.
drop trigger if exists homepage_config_set_updated_at on public.homepage_config;
create trigger homepage_config_set_updated_at
  before update on public.homepage_config
  for each row execute function public.set_updated_at();

-- RLS: world-readable (drives a public page); admin-only writes.
alter table public.homepage_config enable row level security;

drop policy if exists "homepage_config_public_read" on public.homepage_config;
create policy "homepage_config_public_read"
  on public.homepage_config for select
  using (true);

drop policy if exists "homepage_config_admin_write" on public.homepage_config;
create policy "homepage_config_admin_write"
  on public.homepage_config for all
  using (public.is_admin())
  with check (public.is_admin());
