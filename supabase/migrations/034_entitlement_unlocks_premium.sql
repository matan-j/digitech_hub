-- 034_entitlement_unlocks_premium.sql
-- A per-course entitlement (purchase OR admin/gift assignment) must bypass the
-- premium / subscription lock — owning a course explicitly grants access to it,
-- regardless of whether the course is sold per-item (purchase_required) or is
-- flagged premium / all-access (subscription_required, the legacy is_premium=true).
--
-- THE GAP:
--   has_content_access() (migration 019) only consulted has_entitlement() for the
--   'purchase_required' branch. The 'subscription_required' branch checked
--   has_premium_access() alone — so a buyer/assignee of a PREMIUM course saw the
--   course row but was denied its body + (after 032) its lessons/modules → /upgrade
--   redirect or 404, even with an active entitlement.
--
-- THE FIX:
--   Let an active 'course' entitlement also satisfy the 'subscription_required'
--   branch. Everything else is unchanged. This flows everywhere: content_bodies /
--   lesson_bodies (022) and lessons/modules/chapters (via can_view_content_item,
--   unified in 032) all gate on has_content_access().
--
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Safe to apply after 019 (defines the function) and 032.

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
                -- An active per-course entitlement (purchase / admin / gift) unlocks
                -- a premium course just like a live subscription does.
                then public.has_premium_access() or public.has_entitlement('course', ci.id)
              else false
            end
          )
        )
      )
  );
$$;
