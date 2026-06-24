-- 022_rls_visibility.sql
-- Public-first visibility: metadata public, full body gated.
--
-- ⚠️ APPLY-GATED MIGRATION ⚠️
--   This is the ONE migration that is NOT safe to apply blind. It changes read
--   paths: full body must be read from the gated *_bodies child tables, and
--   public metadata from the *_public views below. Apply only AFTER:
--     1. App reads body from content_bodies/lesson_bodies/playbook_bodies.
--     2. Public listing/landing pages read metadata from the *_public views.
--     3. Verified on staging (anon cannot reach any body; entitled users can).
--   Migrations 019–021 are independently safe and do not depend on this file.
--
-- SECURITY MODEL (DB-enforced):
--   * Base content/lesson/playbook tables keep their legacy `body` columns, but
--     anon reaches metadata ONLY through the *_public views (which exclude body).
--   * Full body lives in the *_bodies tables, gated by has_content_access()
--     (migration 019) — open=public, login_required=auth, purchase_required=
--     entitlement, subscription_required=legacy premium.
--   * resources select is entitlement/enrollment aware via has_content_access().

-- ============================================================
-- 1. Public metadata views (safe columns only; body excluded)
--    SECURITY DEFINER semantics: views run as owner, bypassing base RLS, so
--    anon can read published metadata for ALL items (incl. premium) — but the
--    views never select body/video_url/content_url.
-- ============================================================

create or replace view public.content_items_public
with (security_invoker = false) as
  select
    ci.id, ci.type, ci.slug, ci.title, ci.tagline, ci.description,
    ci.cover_url, ci.cover_style, ci.audience, ci.tags, ci.domain,
    ci.duration_minutes, ci.creator_id, ci.content_kind, ci.is_featured,
    ci.seo_title, ci.seo_description, ci.og_image_url,
    ci.access_level, ci.catalog_visibility, ci.preview_enabled,
    ci.price_amount, ci.price_currency, ci.is_premium,
    ci.status, ci.published_at, ci.created_at, ci.updated_at
  from public.content_items ci
  where ci.status = 'published';

create or replace view public.playbooks_public
with (security_invoker = false) as
  select
    p.id, p.slug, p.title, p.tagline, p.cover_url, p.domain, p.tags,
    p.audience, p.source_type, p.source_id,
    p.access_level, p.catalog_visibility, p.preview_enabled,
    p.status, p.created_at
  from public.playbooks p
  where p.status = 'published';

grant select on public.content_items_public to anon, authenticated;
grant select on public.playbooks_public to anon, authenticated;

-- ============================================================
-- 2. Gated body tables — full content, access-checked
-- ============================================================

alter table public.content_bodies enable row level security;

create policy "content_bodies_select_access"
  on public.content_bodies for select
  using (public.has_content_access(content_item_id));

create policy "content_bodies_admin_write"
  on public.content_bodies for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.lesson_bodies enable row level security;

create policy "lesson_bodies_select_access"
  on public.lesson_bodies for select
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and (l.is_preview = true or public.has_content_access(l.course_id))
    )
  );

create policy "lesson_bodies_admin_write"
  on public.lesson_bodies for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.playbook_bodies enable row level security;

create policy "playbook_bodies_select_access"
  on public.playbook_bodies for select
  using (
    exists (
      select 1 from public.playbooks p
      where p.id = playbook_id
        and (
          public.is_admin()
          or (
            p.status = 'published'
            and case coalesce(p.access_level, case when p.is_premium then 'subscription_required' else 'open' end)
              when 'open' then true
              when 'login_required' then auth.uid() is not null
              when 'purchase_required' then public.has_entitlement('playbook', p.id) or public.has_premium_access()
              when 'subscription_required' then public.has_premium_access()
              else false
            end
          )
        )
    )
  );

create policy "playbook_bodies_admin_write"
  on public.playbook_bodies for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 3. resources — entitlement/enrollment aware via has_content_access()
--    Replaces the 005 premium-only check.
-- ============================================================

drop policy if exists "resources_select" on public.resources;

create policy "resources_select"
  on public.resources for select
  using (
    case owner_type
      when 'content_item' then public.has_content_access(owner_id)
      when 'lesson' then exists (
        select 1 from public.lessons l
        where l.id = owner_id and public.has_content_access(l.course_id)
      )
      else false
    end
  );

-- ============================================================
-- 4. content_items base SELECT — keep full row reachable only by access holders;
--    anon discovery now flows through content_items_public.
--    (Replaces 005/014 premium-hides-row behaviour. Body stays protected because
--    anon never selects the base row.)
-- ============================================================

drop policy if exists "content_items_select" on public.content_items;

create policy "content_items_select"
  on public.content_items for select
  using (
    public.is_admin()
    or creator_id = public.my_creator_id()
    or (status = 'published' and public.has_content_access(id))
  );

-- NOTE: lessons/playbooks base SELECT policies (005) are left intact; their full
-- body now lives in *_bodies. Tighten or swap them to the views during the app
-- read-path migration if metadata-only public lesson listings are needed.
