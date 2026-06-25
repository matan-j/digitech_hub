-- 041_backfill_bundle_entitlements.sql
-- Fix: a user who was ASSIGNED or bought a 'bundle' through a non-expanding grant
-- path held only the 'bundle' entitlement row and no per-'course' entitlement, so
-- every course access check — has_entitlement('course', course_id) in RLS
-- (migrations 019/034) and hasActiveEntitlement('course', courseId) on the lesson
-- page — still denied them, bouncing them off the lesson back to the course
-- landing.
--
-- The grant paths are fixed in code (admin assignment, free cart checkout, Sumit
-- settlement now call grantPurchaseAccess, which expands a bundle into one
-- 'course' entitlement per bundle_items row — migration 036). This backfill does
-- the same expansion for entitlements that were ALREADY granted before the fix.
--
-- Idempotent: the unique (user_id, resource_type, resource_id) constraint +
-- ON CONFLICT DO NOTHING make re-runs safe and never override an existing
-- (possibly admin-revoked) course entitlement.

insert into public.entitlements
  (user_id, resource_type, resource_id, order_id, source, status, granted_at)
select
  e.user_id,
  'course',
  bi.course_id,
  e.order_id,
  e.source,
  'active',
  now()
from public.entitlements e
join public.bundle_items bi on bi.bundle_id = e.resource_id
where e.resource_type = 'bundle'
  and e.status = 'active'
on conflict (user_id, resource_type, resource_id) do nothing;
