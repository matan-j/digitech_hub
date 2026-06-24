import 'server-only';
import type { Course, Lesson } from './types';
import { getCourseWithLessons, listPublishedContent } from './db';
import type { CourseWithLessons, DbLesson, DbResource } from './types';

// ----------------------------------------------------------------
// Adapter — maps the new Postgres shape into the legacy Course type
// so existing learner UI (CourseCard, CourseSidebar, MarkCompleteButton,
// VimeoPlayer) keeps working without changes.
// ----------------------------------------------------------------

function mapResource(r: DbResource) {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    sizeMB: r.size_mb ?? undefined,
    kind: r.kind ?? undefined,
  };
}

function mapLesson(l: DbLesson): Lesson {
  return {
    num: l.num,
    slug: l.slug,
    title: l.title,
    vimeoId: l.vimeo_id ?? '',
    duration: l.duration ?? '',
    body: l.body ?? '',
    resources: (l.resources ?? []).map(mapResource),
    locked: !!l.hard_locked,
  };
}

function mapCourse(c: CourseWithLessons): Course {
  return {
    slug: c.slug,
    title: c.title,
    tagline: c.tagline ?? '',
    description: c.description ?? '',
    audience: c.audience ?? undefined,
    cover: (c.cover_style as 'hero' | 'header' | undefined) ?? 'hero',
    coverUrl: c.cover_url ?? null,
    lastUpdated: c.updated_at ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(c.updated_at)) : undefined,
    lessons: [...c.lessons].sort((a, b) => a.position - b.position).map(mapLesson),
  };
}

export async function listCourses(): Promise<Course[]> {
  const items = await listPublishedContent('course');
  const published = items.filter((c) => c.status === 'published');
  // Lessons are not needed for the index view; show empty arrays
  return published.map((c) => ({
    slug: c.slug,
    title: c.title,
    tagline: c.tagline ?? '',
    description: c.description ?? '',
    audience: c.audience ?? undefined,
    cover: c.cover_style,
    coverUrl: c.cover_url ?? null,
    lastUpdated: c.updated_at ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(c.updated_at)) : undefined,
    lessons: [],
  }));
}

export async function getCourse(slug: string): Promise<Course | null> {
  const full = await getCourseWithLessons(slug);
  if (!full) return null;
  return mapCourse(full);
}

export async function getLesson(courseSlug: string, lessonSlug: string) {
  const full = await getCourseWithLessons(courseSlug);
  if (!full) return null;
  const course = mapCourse(full);
  const idx = course.lessons.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) return null;

  // Hierarchical hard lock (migrations 029/031): a lesson is blocked for
  // EVERYONE when its module, its chapter, or the lesson itself is_locked —
  // overriding entitlements and free-preview. getCourseWithLessons already
  // stamped the effective flag onto each flat lesson.
  const dbLesson = full.lessons.find((l) => l.slug === lessonSlug) ?? null;
  const hardLocked = !!dbLesson?.hard_locked;

  return {
    course,
    lesson: course.lessons[idx],
    prev: course.lessons[idx - 1],
    next: course.lessons[idx + 1],
    // Pass through the DB id so we can wire MarkComplete to the API
    lessonId: full.lessons[idx]?.id ?? null,
    isPremium: full.is_premium,
    // Access model (migration 018/024) — for the purchase_required gate.
    accessLevel: full.access_level ?? null,
    courseId: full.id,
    isPreviewLesson: full.lessons[idx]?.is_preview ?? false,
    // Effective hierarchical hard lock (migrations 029/031) — blocks everyone when true.
    hardLocked,
  };
}
