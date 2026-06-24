-- 021_lead_attribution.sql
-- Lead capture + attribution on profiles + a lightweight analytics_events log.
--
-- DESIGN RULES:
--   * Additive only. Every registration becomes a lead/learner record by
--     enriching the existing profiles row (created by the 001 signup trigger).
--   * Attribution is captured once, at first touch, by the AccessModal / auth
--     callback (service-role write). Marketing consent defaults to FALSE.

-- ============================================================
-- 1. profiles — contact + lead + attribution columns
-- ============================================================

alter table public.profiles
  add column if not exists phone text,
  add column if not exists auth_provider text,                       -- google | magic_link
  add column if not exists lead_status text not null default 'new',
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists registration_source text,                 -- e.g. guide:slug, course:slug, homepage
  add column if not exists referrer text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists first_guide_touchpoint text,
  add column if not exists first_creator_touchpoint text,
  add column if not exists first_course_touchpoint text,
  add column if not exists intended_action text,
  add column if not exists last_activity_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_lead_status_check;
alter table public.profiles
  add constraint profiles_lead_status_check
  check (lead_status in ('new','registered','active_learner','purchased','inactive'));

create index if not exists profiles_lead_status_idx on public.profiles(lead_status);
create index if not exists profiles_utm_source_idx on public.profiles(utm_source);

-- ============================================================
-- 2. analytics_events — generic event log (views, intents, enrolls, purchases)
-- ============================================================

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  event_type text not null,            -- view_guide | start_course | intent_purchase | enroll | purchase | ...
  resource_type text,
  resource_id uuid,
  path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx on public.analytics_events(user_id);
create index if not exists analytics_events_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_occurred_idx on public.analytics_events(occurred_at);

-- ============================================================
-- 3. RLS — analytics_events: admin reads all; users insert their own.
--    Anonymous events are written service-role from the API layer.
-- ============================================================

alter table public.analytics_events enable row level security;

create policy "analytics_events_admin_select"
  on public.analytics_events for select
  using (public.is_admin());

create policy "analytics_events_insert_own_or_anon"
  on public.analytics_events for insert
  with check (user_id is null or user_id = auth.uid());
