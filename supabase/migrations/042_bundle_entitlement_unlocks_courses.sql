-- 042_bundle_entitlement_unlocks_courses.sql
-- "Assignment overrides everything": an active 'bundle' entitlement must grant
-- FULL access to every course inside the bundle, no matter how the entitlement
-- was created (admin assignment, purchase, gift) and WITHOUT relying on per-course
-- entitlement rows having been materialised at grant time.
--
-- THE GAP:
--   has_entitlement('course', course_id) (migration 019) only matched a DIRECT
--   row (resource_type='course', resource_id=course_id). A user who owned the
--   bundle but had no expanded per-course row was denied by every access check —
--   has_content_access() in RLS (lessons/modules/chapters/bodies) and the lesson
--   page's hasActiveEntitlement() — and got bounced off the lesson back to the
--   course landing.
--
-- THE FIX:
--   Make has_entitlement() bundle-aware for the 'course' case: a course access
--   check also passes when the user holds an active, unexpired 'bundle'
--   entitlement for a bundle that contains the course (bundle_items, migration
--   036). All other resource types are unaffected (the bundle branch is guarded
--   by p_resource_type = 'course'). This flows everywhere has_content_access()
--   gates content, so the unlock is consistent across the whole read path.
--
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Safe to apply after 019 (defines has_entitlement) and 036 (bundle_items).

create or replace function public.has_entitlement(p_resource_type text, p_resource_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
      and (
        -- Direct entitlement on the requested resource.
        (e.resource_type = p_resource_type and e.resource_id = p_resource_id)
        -- A course is also unlocked by an owned bundle that contains it.
        or (
          p_resource_type = 'course'
          and e.resource_type = 'bundle'
          and exists (
            select 1 from public.bundle_items bi
            where bi.bundle_id = e.resource_id
              and bi.course_id = p_resource_id
          )
        )
      )
  );
$$;
