-- 031_module_lesson_lock.sql
-- Extend the per-chapter HARD lock (migration 029) to MODULES and individual
-- LESSONS, completing the hierarchical lock model:
--
--   module.is_locked  = true → the module AND every chapter/lesson under it is
--                              blocked for EVERYONE (guests, purchasers,
--                              subscribers, admin-granted users and admins).
--   chapter.is_locked = true → the chapter AND every lesson in it is blocked
--                              (the parent module stays open). [migration 029]
--   lesson.is_locked  = true → only that one lesson is blocked (its chapter and
--                              module stay open).
--
-- Locking always OVERRIDES entitlements AND free-preview (is_preview). The
-- effective lock of a lesson is: module.is_locked OR chapter.is_locked OR
-- lesson.is_locked.
--
-- Additive + idempotent. Safe to re-run.

alter table public.modules
  add column if not exists is_locked boolean not null default false;

alter table public.lessons
  add column if not exists is_locked boolean not null default false;

-- ============================================================
-- Re-affirm modules_public (migration 026) with the new is_locked column so a
-- guest/public read of a published course can render the lock cascade.
-- DROP+CREATE to be robust against an older column order in the live DB.
-- Nothing depends on these views.
-- ============================================================
drop view if exists public.modules_public;
create view public.modules_public
with (security_invoker = false) as
  select
    m.id, m.course_id, m.num, m.slug, m.title, m.duration,
    m.position, m.created_at, m.is_locked
  from public.modules m
  join public.content_items ci on ci.id = m.course_id
  where ci.status = 'published' and ci.type = 'course';

drop view if exists public.lessons_public;
create view public.lessons_public
with (security_invoker = false) as
  select
    l.id, l.course_id, l.module_id, l.chapter_id, l.num, l.slug,
    l.title, l.duration, l.position, l.is_preview, l.is_locked
  from public.lessons l
  join public.content_items ci on ci.id = l.course_id
  where ci.status = 'published';

grant select on public.modules_public to anon, authenticated;
grant select on public.lessons_public to anon, authenticated;
