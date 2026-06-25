-- 038_preview_lesson_public_body.sql
-- Make UNLOCKED (free-preview) lessons viewable by non-buyers.
--
-- THE BUG:
--   A lesson with is_preview=true is meant to be open to everyone — including
--   visitors who have NOT purchased the course ("שיעור שלא נעול מוצג גם למי שלא
--   רכש"). But the app reads lesson metadata + body from the RLS-gated base
--   tables (content_items / lessons). Migration 022 gated content_items on
--   has_content_access(), and 032 redefined can_view_content_item() (the lessons
--   policy) to has_content_access() too — NEITHER has an is_preview exception.
--   So a non-buyer's gated read returns nothing → getLesson() is null → the
--   lesson page redirects to the course landing before the is_preview gate runs.
--   The lessons_public view (031) exposes preview lessons' metadata but not their
--   body/vimeo_id, so there was no non-gated path to the preview CONTENT.
--
-- THE FIX (additive, view-only — no base-table RLS change):
--   Recreate lessons_public to also carry body + vimeo_id, but MASKED so the
--   content is exposed ONLY for an unlocked preview lesson
--   (is_preview = true AND is_locked = false). Non-preview / locked lessons keep
--   returning NULL body/vimeo through this view, so paid content never leaks.
--   The app falls back to this view for non-buyers and renders only preview
--   lessons; the hierarchical hard-lock cascade (module/chapter) is still
--   enforced in the lesson page (it redirects hard-locked lessons for everyone).
--
-- ⚠️ RLS / access-exposure CHANGE — review + apply per the project's RLS approval
--   process (CLAUDE.md). Safe to apply after 031 (defines lessons_public +
--   lessons.is_locked) and 018 (lessons.body / vimeo_id).

drop view if exists public.lessons_public;
create view public.lessons_public
with (security_invoker = false) as
  select
    l.id, l.course_id, l.module_id, l.chapter_id, l.num, l.slug,
    l.title, l.duration, l.position, l.is_preview, l.is_locked,
    -- Content is exposed ONLY for an unlocked preview lesson. Everything else
    -- stays NULL here and remains reachable only through the gated base table.
    case when l.is_preview and not l.is_locked then l.body end as body,
    case when l.is_preview and not l.is_locked then l.vimeo_id end as vimeo_id
  from public.lessons l
  join public.content_items ci on ci.id = l.course_id
  where ci.status = 'published';

grant select on public.lessons_public to anon, authenticated;
