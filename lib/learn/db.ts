import { createClient } from '@/lib/supabase/server';
import type {
  ChapterWithLessons,
  ContentItem,
  ContentType,
  CourseWithLessons,
  CourseWithModules,
  DbChapter,
  DbLesson,
  DbModule,
  DbResource,
  GuideBlock,
  GuideItem,
  ModuleWithChildren,
  Playbook,
} from './types';

// ============================================================
// Reads — go through the request-scoped (RLS-aware) client
// ============================================================

async function db() {
  return await createClient();
}

// ----- Content items -----

export async function listContent(type: ContentType): Promise<ContentItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', type)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentItem[];
}

export async function getContentBySlug(type: ContentType, slug: string): Promise<ContentItem | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', type)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as ContentItem | null;
}

export async function getContentById(id: string): Promise<ContentItem | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ContentItem | null;
}

// ----- Courses (with modules → chapters → lessons hierarchy) -----

export async function getCourseWithModules(slug: string): Promise<CourseWithModules | null> {
  const supabase = await db();
  const { data: course, error: cErr } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', 'course')
    .eq('slug', slug)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!course) return null;

  // Fetch modules + lessons in parallel; chapters depend on module ids
  const [modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from('modules')
      .select('*')
      .eq('course_id', course.id)
      .order('position', { ascending: true }),
    supabase
      .from('lessons')
      .select('*')
      .eq('course_id', course.id)
      .order('position', { ascending: true }),
  ]);
  if (modulesRes.error) throw modulesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const modules = (modulesRes.data ?? []) as DbModule[];
  const lessons = (lessonsRes.data ?? []) as DbLesson[];
  const moduleIds = modules.map((m) => m.id);

  // Chapters + all resources in parallel
  const [chaptersRes, resourcesRes] = await Promise.all([
    moduleIds.length
      ? supabase
          .from('chapters')
          .select('*')
          .in('module_id', moduleIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as DbChapter[], error: null }),
    (async () => {
      const ids = [
        ...moduleIds,
        ...lessons.map((l) => l.id),
      ];
      if (!ids.length) return { data: [] as DbResource[], error: null };
      return supabase.from('resources').select('*').in('owner_id', ids);
    })(),
  ]);
  if (chaptersRes.error) throw chaptersRes.error;
  if (resourcesRes.error) throw resourcesRes.error;

  const chapters = (chaptersRes.data ?? []) as DbChapter[];
  const chapterIds = chapters.map((c) => c.id);

  // One additional fetch for chapter-owned resources (we don't know chapter ids until now)
  let chapterResources: DbResource[] = [];
  if (chapterIds.length) {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('owner_type', 'chapter')
      .in('owner_id', chapterIds);
    if (error) throw error;
    chapterResources = (data ?? []) as DbResource[];
  }

  const allResources = [...((resourcesRes.data ?? []) as DbResource[]), ...chapterResources];

  // Group resources by owner
  const resByOwner = new Map<string, DbResource[]>();
  for (const r of allResources) {
    const list = resByOwner.get(r.owner_id);
    if (list) list.push(r);
    else resByOwner.set(r.owner_id, [r]);
  }

  // Build chapter → lessons map
  const lessonsByChapter = new Map<string, DbLesson[]>();
  const lessonsByModuleDirect = new Map<string, DbLesson[]>(); // chapter_id IS NULL
  for (const l of lessons) {
    const enriched: DbLesson = { ...l, resources: resByOwner.get(l.id) ?? [] };
    if (enriched.chapter_id) {
      const list = lessonsByChapter.get(enriched.chapter_id);
      if (list) list.push(enriched);
      else lessonsByChapter.set(enriched.chapter_id, [enriched]);
    } else {
      const list = lessonsByModuleDirect.get(enriched.module_id);
      if (list) list.push(enriched);
      else lessonsByModuleDirect.set(enriched.module_id, [enriched]);
    }
  }

  // Build module → chapters map
  const chaptersByModule = new Map<string, ChapterWithLessons[]>();
  for (const c of chapters) {
    const enriched: ChapterWithLessons = {
      ...c,
      resources: resByOwner.get(c.id) ?? [],
      lessons: lessonsByChapter.get(c.id) ?? [],
    };
    const list = chaptersByModule.get(c.module_id);
    if (list) list.push(enriched);
    else chaptersByModule.set(c.module_id, [enriched]);
  }

  const enrichedModules: ModuleWithChildren[] = modules.map((m) => ({
    ...m,
    resources: resByOwner.get(m.id) ?? [],
    chapters: chaptersByModule.get(m.id) ?? [],
    lessons: lessonsByModuleDirect.get(m.id) ?? [],
  }));

  return { ...(course as ContentItem), type: 'course', modules: enrichedModules };
}

/**
 * @deprecated Use {@link getCourseWithModules}. Kept as a flat-lesson shim for legacy callers
 * (bulk-import, playbooks-from-course, courses.ts mapper). Flattens modules → chapters → lessons
 * in position order.
 */
export async function getCourseWithLessons(slug: string): Promise<CourseWithLessons | null> {
  const course = await getCourseWithModules(slug);
  if (!course) return null;

  const flat: DbLesson[] = [];
  for (const m of course.modules) {
    for (const c of m.chapters) {
      for (const l of c.lessons) flat.push(l);
    }
    for (const l of m.lessons) flat.push(l);
  }
  // Restore the legacy CourseWithLessons shape (no `modules` field)
  const { modules: _modules, ...courseBase } = course;
  void _modules;
  return { ...(courseBase as ContentItem), type: 'course', lessons: flat };
}

export async function getDbModuleById(id: string): Promise<DbModule | null> {
  const supabase = await db();
  const { data, error } = await supabase.from('modules').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as DbModule) ?? null;
}

export async function getDbChapterById(id: string): Promise<DbChapter | null> {
  const supabase = await db();
  const { data, error } = await supabase.from('chapters').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as DbChapter) ?? null;
}

export async function getDbLessonById(lessonId: string): Promise<DbLesson | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();
  if (error) throw error;
  return data as DbLesson | null;
}

// ----- Guides -----

export async function getGuide(slug: string): Promise<GuideItem | null> {
  const item = await getContentBySlug('guide', slug);
  if (!item) return null;
  return {
    ...(item as ContentItem),
    type: 'guide',
    body: (item.body ?? []) as GuideBlock[],
  };
}

// ----- Playbooks -----

export async function listPlaybooks(): Promise<Playbook[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Playbook[];
}

export async function getPlaybook(id: string): Promise<Playbook | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Playbook | null;
}

export async function listPlaybooksForCourse(courseId: string): Promise<Playbook[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('source_type', 'course')
    .eq('source_id', courseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Playbook[];
}

// ----- Progress (server-side replacement for localStorage) -----

/**
 * Returns per-course aggregated progress {courseId: {done, total}}
 * for every published course this user can see.
 */
export async function progressByCourse(userId: string): Promise<Record<string, { done: number; total: number }>> {
  const supabase = await db();
  const { data: lessonRows, error } = await supabase
    .from('lessons')
    .select('id, course_id, content_items!inner(status)')
    .eq('content_items.status', 'published');
  if (error) {
    console.error('[progressByCourse:lessons]', error);
    return {};
  }
  type Row = { id: string; course_id: string };
  const rows = (lessonRows ?? []) as unknown as Row[];

  const totalByCourse = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.course_id] = (acc[r.course_id] ?? 0) + 1;
    return acc;
  }, {});

  const lessonIds = rows.map((r) => r.id);
  if (lessonIds.length === 0) return {};

  const { data: progRows } = await supabase
    .from('progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds);

  const lessonToCourse = new Map(rows.map((r) => [r.id, r.course_id] as const));
  const doneByCourse: Record<string, number> = {};
  for (const p of (progRows ?? []) as { lesson_id: string }[]) {
    const c = lessonToCourse.get(p.lesson_id);
    if (c) doneByCourse[c] = (doneByCourse[c] ?? 0) + 1;
  }

  const out: Record<string, { done: number; total: number }> = {};
  for (const [courseId, total] of Object.entries(totalByCourse)) {
    out[courseId] = { done: doneByCourse[courseId] ?? 0, total };
  }
  return out;
}

export async function getCompletedLessonIds(userId: string, courseId?: string): Promise<string[]> {
  const supabase = await db();
  if (courseId) {
    const { data, error } = await supabase
      .from('progress')
      .select('lesson_id, lessons!inner(course_id)')
      .eq('user_id', userId)
      .eq('lessons.course_id', courseId);
    if (error) throw error;
    return (data ?? []).map((r: { lesson_id: string }) => r.lesson_id);
  }
  const { data, error } = await supabase
    .from('progress')
    .select('lesson_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: { lesson_id: string }) => r.lesson_id);
}

// ============================================================
// Admin counts — used by the /admin dashboard
// ============================================================

export async function adminCounts(): Promise<{
  courses: { total: number; published: number };
  guides: { total: number; published: number };
  playbooks: number;
}> {
  const supabase = await db();
  const [
    coursesTotal,
    coursesPublished,
    guidesTotal,
    guidesPublished,
    playbooks,
  ] = await Promise.all([
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('type', 'course'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('type', 'course').eq('status', 'published'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('type', 'guide'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('type', 'guide').eq('status', 'published'),
    supabase.from('playbooks').select('id', { count: 'exact', head: true }),
  ]);

  return {
    courses: { total: coursesTotal.count ?? 0, published: coursesPublished.count ?? 0 },
    guides: { total: guidesTotal.count ?? 0, published: guidesPublished.count ?? 0 },
    playbooks: playbooks.count ?? 0,
  };
}
