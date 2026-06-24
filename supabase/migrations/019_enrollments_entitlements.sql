-- 019_enrollments_entitlements.sql
-- Free-course enrollments + paid entitlements + the central access helper.
--
-- DESIGN RULES:
--   * Additive only. No drops/renames.
--   * enrollments  -> FREE courses (login_required content the user joined).
--   * entitlements -> PAID access granted ONLY by a verified order (migration 020).
--   * has_content_access(item_id) is the single SQL source of truth that mirrors
--     lib/learn/access.ts#decideAccess for the FULL body. Reused by 022 RLS.

-- ============================================================
-- 1. enrollments — free course membership ("my learning")
-- ============================================================

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  source text not null default 'free' check (source in ('free','admin','migration')),
  status text not null default 'active' check (status in ('active','cancelled')),
  enrolled_at timestamptz not null default now(),
  last_activity_at timestamptz,
  unique (user_id, content_item_id)
);

create index if not exists enrollments_user_idx on public.enrollments(user_id);
create index if not exists enrollments_item_idx on public.enrollments(content_item_id);

-- ============================================================
-- 2. entitlements — paid / granted access to a specific resource
-- ============================================================

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('course','guide','playbook','resource','bundle')),
  resource_id uuid not null,
  source text not null default 'purchase' check (source in ('purchase','admin','migration','gift')),
  order_id uuid, -- FK added in 020 once orders exists
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  unique (user_id, resource_type, resource_id)
);

create index if not exists entitlements_user_idx on public.entitlements(user_id);
create index if not exists entitlements_resource_idx on public.entitlements(resource_type, resource_id);

-- ============================================================
-- 3. Helper functions (SECURITY DEFINER, match 005/014 style)
-- ============================================================

-- Is the current user actively enrolled in a (free) content item?
create or replace function public.is_enrolled(p_content_item_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid()
      and content_item_id = p_content_item_id
      and status = 'active'
  );
$$;

-- Does the current user hold an active, unexpired entitlement to a resource?
create or replace function public.has_entitlement(p_resource_type text, p_resource_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.entitlements
    where user_id = auth.uid()
      and resource_type = p_resource_type
      and resource_id = p_resource_id
      and status = 'active'
      and (expires_at is null or expires_at > now())
  );
$$;

-- Central access decision for a content_item's FULL body.
-- Mirrors lib/learn/access.ts#decideAccess. Falls back to legacy is_premium when
-- access_level has not been set yet (pre-018 rows already migrated, but safe).
create or replace function public.has_content_access(p_item_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.content_items ci
    where ci.id = p_item_id
      and (
        public.is_admin()
        or ci.creator_id = public.my_creator_id()
        or (
          ci.status = 'published'
          and (
            case coalesce(
                   ci.access_level,
                   case when ci.is_premium then 'subscription_required' else 'open' end
                 )
              when 'open' then true
              when 'login_required' then auth.uid() is not null
              when 'purchase_required'
                then public.has_entitlement('course', ci.id) or public.has_premium_access()
              when 'subscription_required'
                then public.has_premium_access()
              else false
            end
          )
        )
      )
  );
$$;

-- ============================================================
-- 4. RLS — enrollments + entitlements (own-or-admin)
-- ============================================================

alter table public.enrollments enable row level security;

create policy "enrollments_select_own_or_admin"
  on public.enrollments for select
  using (user_id = auth.uid() or public.is_admin());

create policy "enrollments_insert_own"
  on public.enrollments for insert
  with check (user_id = auth.uid());

create policy "enrollments_update_own"
  on public.enrollments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "enrollments_admin_write"
  on public.enrollments for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.entitlements enable row level security;

-- Read your own entitlements; admins read all. Writes are service-role only
-- (granted by the verified-webhook order flow) — no public insert/update policy.
create policy "entitlements_select_own_or_admin"
  on public.entitlements for select
  using (user_id = auth.uid() or public.is_admin());

create policy "entitlements_admin_write"
  on public.entitlements for all
  using (public.is_admin())
  with check (public.is_admin());
