import { createClient } from '@/lib/supabase/server';
import type {
  BundleCourseRef,
  BundleWithCourses,
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
  CategoryRef,
  Creator,
  CreatorRef,
  CreatorStats,
  Playlist,
} from './types';
import type { Category } from './domains';

// ============================================================
// Reads — go through the request-scoped (RLS-aware) client
// ============================================================

async function db() {
  return await createClient();
}

// ----- Content items -----

// We fetch the junction → categories separately rather than via PostgREST
// nested embed. The embed path is finicky after schema migrations (cache
// reloads, FK resolution through many-to-many), and a second small query
// is more robust and easier to debug.
async function attachContentCategories<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof db>>,
  items: T[],
): Promise<Array<T & { categories: CategoryRef[] }>> {
  if (items.length === 0) return items.map((i) => ({ ...i, categories: [] as CategoryRef[] }));
  const ids = items.map((i) => i.id);
  const { data, error } = await supabase
    .from('content_item_categories')
    .select('content_item_id, categories ( id, slug, name, domain )')
    .in('content_item_id', ids);
  if (error) {
    console.error('[attachContentCategories]', error);
    return items.map((i) => ({ ...i, categories: [] as CategoryRef[] }));
  }
  const byId = new Map<string, CategoryRef[]>();
  type JunctionRow = { content_item_id: string; categories: CategoryRef | CategoryRef[] | null };
  for (const row of (data ?? []) as unknown as JunctionRow[]) {
    // Supabase may return the embedded record as an object OR a 1-element array
    // depending on its FK introspection. Normalize.
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (!cat) continue;
    const arr = byId.get(row.content_item_id) ?? [];
    arr.push(cat);
    byId.set(row.content_item_id, arr);
  }
  return items.map((i) => ({ ...i, categories: byId.get(i.id) ?? [] }));
}

export async function listContent(type: ContentType): Promise<ContentItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', type)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContentItem[];
  return await attachContentCategories(supabase, rows);
}

/**
 * Public discovery listing — reads PUBLISHED-item metadata from the
 * `content_items_public` view (migration 022/024/026) instead of the RLS-gated
 * base table. This is what lets anonymous visitors see premium/paid courses in
 * the catalog (shown locked); the body/video stays gated in the base tables.
 * Use this on public (non-admin) pages; admin listings keep using listContent.
 */
export async function listPublishedContent(type: ContentType): Promise<ContentItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items_public')
    .select('*')
    .eq('type', type)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContentItem[];
  return await attachContentCategories(supabase, rows);
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
  if (!data) return null;
  const [row] = await attachContentCategories(supabase, [data as ContentItem]);
  return row;
}

/**
 * A bundle (type='bundle' content item) plus its contained courses, in bundle
 * order (bundle_items.position). Returns null if the slug isn't a bundle.
 *
 * `base` (default) reads the RLS-gated table — admin editor + entitled viewers.
 * `public` reads content_items_public so a guest / non-buyer can still render
 * the bundle landing (a purchase_required bundle row is hidden by RLS in base).
 * bundle_items has a public-read policy (migration 036), so the course list
 * resolves either way.
 */
export async function getBundleWithCourses(
  slug: string,
  opts: { source?: 'base' | 'public' } = {},
): Promise<BundleWithCourses | null> {
  const supabase = await db();
  const table = opts.source === 'public' ? 'content_items_public' : 'content_items';
  const { data: bundle, error } = await supabase
    .from(table)
    .select('*')
    .eq('type', 'bundle')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!bundle) return null;

  const { data: links, error: lErr } = await supabase
    .from('bundle_items')
    .select('course_id, position')
    .eq('bundle_id', (bundle as ContentItem).id)
    .order('position', { ascending: true });
  if (lErr) throw lErr;

  const courseIds = (links ?? []).map((r) => (r as { course_id: string }).course_id);
  let courses: BundleCourseRef[] = [];
  if (courseIds.length > 0) {
    const { data: cs } = await supabase
      .from(table)
      .select('id, slug, title, cover_url, price_amount, sale_amount, price_currency, status')
      .in('id', courseIds);
    const byId = new Map((cs ?? []).map((c) => [(c as BundleCourseRef).id, c as BundleCourseRef]));
    // Preserve bundle order; drop any course that no longer exists.
    courses = courseIds.map((id) => byId.get(id)).filter(Boolean) as BundleCourseRef[];
  }

  return { ...(bundle as ContentItem), type: 'bundle', courses };
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

export async function getCourseWithModules(
  slug: string,
  opts: { source?: 'base' | 'public' } = {},
): Promise<CourseWithModules | null> {
  const supabase = await db();
  // `public` reads metadata from the RLS-bypassing *_public views (no bodies),
  // so a guest can render a locked course landing for a premium/paid course.
  // `base` (default) reads the gated tables — full content for those with access
  // and for admin tooling.
  const isPublic = opts.source === 'public';
  const T = {
    content: isPublic ? 'content_items_public' : 'content_items',
    modules: isPublic ? 'modules_public' : 'modules',
    chapters: isPublic ? 'chapters_public' : 'chapters',
    lessons: isPublic ? 'lessons_public' : 'lessons',
  } as const;
  const { data: course, error: cErr } = await supabase
    .from(T.content)
    .select('*')
    .eq('type', 'course')
    .eq('slug', slug)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!course) return null;

  // Fetch modules + lessons in parallel; chapters depend on module ids
  const [modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from(T.modules)
      .select('*')
      .eq('course_id', course.id)
      .order('position', { ascending: true }),
    supabase
      .from(T.lessons)
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
          .from(T.chapters)
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
    // Hierarchical hard lock (migrations 029/031): a lesson is locked if its
    // module, its chapter, or the lesson itself is_locked. Module lock cascades
    // to every chapter/lesson; chapter lock cascades to its lessons.
    const moduleLocked = !!m.is_locked;
    for (const c of m.chapters) {
      const chapterLocked = moduleLocked || !!c.is_locked;
      for (const l of c.lessons) flat.push({ ...l, hard_locked: chapterLocked || !!l.is_locked });
    }
    for (const l of m.lessons) flat.push({ ...l, hard_locked: moduleLocked || !!l.is_locked });
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

async function attachPlaybookCategories<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof db>>,
  items: T[],
): Promise<Array<T & { categories: CategoryRef[] }>> {
  if (items.length === 0) return items.map((i) => ({ ...i, categories: [] as CategoryRef[] }));
  const ids = items.map((i) => i.id);
  const { data, error } = await supabase
    .from('playbook_categories')
    .select('playbook_id, categories ( id, slug, name, domain )')
    .in('playbook_id', ids);
  if (error) {
    console.error('[attachPlaybookCategories]', error);
    return items.map((i) => ({ ...i, categories: [] as CategoryRef[] }));
  }
  const byId = new Map<string, CategoryRef[]>();
  type JunctionRow = { playbook_id: string; categories: CategoryRef | CategoryRef[] | null };
  for (const row of (data ?? []) as unknown as JunctionRow[]) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (!cat) continue;
    const arr = byId.get(row.playbook_id) ?? [];
    arr.push(cat);
    byId.set(row.playbook_id, arr);
  }
  return items.map((i) => ({ ...i, categories: byId.get(i.id) ?? [] }));
}

export async function listPlaybooks(): Promise<Playbook[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Playbook[];
  return await attachPlaybookCategories(supabase, rows);
}

export async function getPlaybook(id: string): Promise<Playbook | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await attachPlaybookCategories(supabase, [data as Playbook]);
  return row;
}

export async function getPlaybookBySlug(slug: string): Promise<Playbook | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await attachPlaybookCategories(supabase, [data as Playbook]);
  return row;
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
  const rows = (data ?? []) as Playbook[];
  return await attachPlaybookCategories(supabase, rows);
}

// ----- Categories taxonomy -----

export async function listCategories(): Promise<Category[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('domain', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
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
// Creator Hub — creators, playlists, guide views
// ============================================================

const CREATOR_REF_COLS =
  'id, slug, name, avatar_url, role_title, website, linkedin, instagram, youtube, tiktok, email';

/** Attach the joined creator summary to a set of content items / playlists. */
async function attachCreators<T extends { creator_id: string | null }>(
  supabase: Awaited<ReturnType<typeof db>>,
  items: T[],
): Promise<Array<T & { creator: CreatorRef | null }>> {
  const ids = Array.from(new Set(items.map((i) => i.creator_id).filter((x): x is string => !!x)));
  if (ids.length === 0) return items.map((i) => ({ ...i, creator: null }));
  const { data, error } = await supabase
    .from('creators')
    .select(CREATOR_REF_COLS)
    .in('id', ids);
  if (error) {
    console.error('[attachCreators]', error);
    return items.map((i) => ({ ...i, creator: null }));
  }
  const byId = new Map<string, CreatorRef>();
  for (const c of (data ?? []) as CreatorRef[]) byId.set(c.id, c);
  return items.map((i) => ({ ...i, creator: i.creator_id ? byId.get(i.creator_id) ?? null : null }));
}

export async function listCreators(opts?: { activeOnly?: boolean }): Promise<Creator[]> {
  const supabase = await db();
  let q = supabase.from('creators').select('*');
  if (opts?.activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Creator[];
}

export async function listFeaturedCreators(limit = 6): Promise<Creator[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Creator[];
}

export async function getCreatorBySlug(slug: string): Promise<Creator | null> {
  const supabase = await db();
  const { data, error } = await supabase.from('creators').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as Creator) ?? null;
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const supabase = await db();
  const { data, error } = await supabase.from('creators').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Creator) ?? null;
}

/** Counts for a creator. `publishedOnly` limits guides/playlists to published. */
export async function getCreatorStats(creatorId: string, publishedOnly = true): Promise<CreatorStats> {
  const supabase = await db();
  let guidesQ = supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'guide')
    .eq('creator_id', creatorId);
  if (publishedOnly) guidesQ = guidesQ.eq('status', 'published');

  let playlistsQ = supabase
    .from('playlists')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (publishedOnly) playlistsQ = playlistsQ.eq('status', 'published');

  // View count via SECURITY DEFINER RPC so it works for public viewers too
  // (guide_views rows are otherwise readable only by admins/owners).
  const viewsQ = supabase.rpc('creator_total_views', { p_creator_id: creatorId });

  const [guides, playlists, viewsRes] = await Promise.all([guidesQ, playlistsQ, viewsQ]);

  const views = typeof viewsRes.data === 'number' ? viewsRes.data : Number(viewsRes.data ?? 0);

  return { guides: guides.count ?? 0, playlists: playlists.count ?? 0, views };
}

/** View counts keyed by content_item_id (admin/creator stats). */
export async function getGuideViewCounts(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const supabase = await db();
  const { data, error } = await supabase
    .from('guide_views')
    .select('content_item_id')
    .in('content_item_id', ids);
  if (error) {
    console.error('[getGuideViewCounts]', error);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { content_item_id: string }[]) {
    out[r.content_item_id] = (out[r.content_item_id] ?? 0) + 1;
  }
  return out;
}

/** Record a single guide view. Best-effort; never throws to the caller. */
export async function recordGuideView(contentItemId: string, viewerId: string | null): Promise<void> {
  try {
    const supabase = await db();
    await supabase.from('guide_views').insert({ content_item_id: contentItemId, viewer_id: viewerId });
  } catch (err) {
    console.error('[recordGuideView]', err);
  }
}

// ----- Guides (creator-aware listings) -----

/** Published guides for the public hub, newest first, with creator + categories. */
export async function listPublishedGuides(): Promise<ContentItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', 'guide')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContentItem[];
  const withCats = await attachContentCategories(supabase, rows);
  return await attachCreators(supabase, withCats);
}

export async function listFeaturedGuides(limit = 6): Promise<ContentItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('type', 'guide')
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as ContentItem[];
  const withCats = await attachContentCategories(supabase, rows);
  return await attachCreators(supabase, withCats);
}

/** Guides owned by a creator. `publishedOnly` for public pages; false for the dashboard. */
export async function listGuidesByCreator(creatorId: string, publishedOnly = true): Promise<ContentItem[]> {
  const supabase = await db();
  let q = supabase.from('content_items').select('*').eq('type', 'guide').eq('creator_id', creatorId);
  if (publishedOnly) q = q.eq('status', 'published');
  const { data, error } = await q
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContentItem[];
  return await attachContentCategories(supabase, rows);
}

/** A single guide with its creator joined. */
export async function getGuideWithCreator(slug: string): Promise<(GuideItem & { creator: CreatorRef | null }) | null> {
  const guide = await getGuide(slug);
  if (!guide) return null;
  const supabase = await db();
  const [withCreator] = await attachCreators(supabase, [guide]);
  return { ...guide, creator: withCreator.creator };
}

// ----- Playlists -----

export async function listPlaylists(opts?: { publishedOnly?: boolean }): Promise<Playlist[]> {
  const supabase = await db();
  let q = supabase.from('playlists').select('*');
  if (opts?.publishedOnly) q = q.eq('status', 'published');
  const { data, error } = await q
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Playlist[];
  return await attachCreators(supabase, rows);
}

export async function listFeaturedPlaylists(limit = 6): Promise<Playlist[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Playlist[];
  return await attachCreators(supabase, rows);
}

export async function listPlaylistsByCreator(creatorId: string, publishedOnly = true): Promise<Playlist[]> {
  const supabase = await db();
  let q = supabase.from('playlists').select('*').eq('creator_id', creatorId);
  if (publishedOnly) q = q.eq('status', 'published');
  const { data, error } = await q
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Playlist[];
}

export async function getPlaylistById(id: string): Promise<Playlist | null> {
  const supabase = await db();
  const { data, error } = await supabase.from('playlists').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await attachCreators(supabase, [data as Playlist]);
  return row;
}

/** Counts of items per playlist (for cards). */
export async function getPlaylistItemCounts(playlistIds: string[]): Promise<Record<string, number>> {
  if (playlistIds.length === 0) return {};
  const supabase = await db();
  const { data, error } = await supabase
    .from('playlist_items')
    .select('playlist_id')
    .in('playlist_id', playlistIds);
  if (error) {
    console.error('[getPlaylistItemCounts]', error);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { playlist_id: string }[]) {
    out[r.playlist_id] = (out[r.playlist_id] ?? 0) + 1;
  }
  return out;
}

/** Ordered guides inside a playlist (RLS already filters unpublished for the public). */
export async function getPlaylistGuides(playlistId: string): Promise<ContentItem[]> {
  const supabase = await db();
  const { data: items, error } = await supabase
    .from('playlist_items')
    .select('content_item_id, sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const ordered = (items ?? []) as { content_item_id: string; sort_order: number }[];
  if (ordered.length === 0) return [];

  const { data: rows, error: cErr } = await supabase
    .from('content_items')
    .select('*')
    .in('id', ordered.map((o) => o.content_item_id));
  if (cErr) throw cErr;

  const byId = new Map((rows ?? []).map((r) => [(r as ContentItem).id, r as ContentItem]));
  const sorted = ordered.map((o) => byId.get(o.content_item_id)).filter((x): x is ContentItem => !!x);
  const withCats = await attachContentCategories(supabase, sorted);
  return await attachCreators(supabase, withCats);
}

/** Published playlists that contain a given guide (for the guide detail page). */
export async function getPlaylistsContainingGuide(contentItemId: string): Promise<Playlist[]> {
  const supabase = await db();
  const { data: links, error } = await supabase
    .from('playlist_items')
    .select('playlist_id')
    .eq('content_item_id', contentItemId);
  if (error) {
    console.error('[getPlaylistsContainingGuide]', error);
    return [];
  }
  const ids = Array.from(new Set((links ?? []).map((l) => (l as { playlist_id: string }).playlist_id)));
  if (ids.length === 0) return [];
  const { data, error: pErr } = await supabase
    .from('playlists')
    .select('*')
    .in('id', ids)
    .eq('status', 'published');
  if (pErr) throw pErr;
  return (data ?? []) as Playlist[];
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
