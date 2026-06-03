import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function slugify(input: string, fallback = 'lesson'): string {
  const s = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[֐-׿]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  const supabase = await createClient();

  const { data: course, error: cErr } = await supabase
    .from('content_items')
    .select('id')
    .eq('type', 'course')
    .eq('slug', slug)
    .maybeSingle();
  if (cErr || !course) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });

  // Resolve target module: explicit > first module in course (back-compat for bulk-import).
  let moduleId: string | null = (body.module_id ?? null) as string | null;
  if (!moduleId) {
    const { data: firstModule } = await supabase
      .from('modules')
      .select('id')
      .eq('course_id', course.id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();
    moduleId = firstModule?.id ?? null;
  }
  if (!moduleId) {
    return NextResponse.json(
      { error: 'no_module', message: 'הקורס לא מכיל מודולים. צור מודול לפני הוספת שיעור.' },
      { status: 400 }
    );
  }

  // Validate chapter (if provided) belongs to the resolved module
  const chapterId: string | null = (body.chapter_id ?? null) as string | null;
  if (chapterId) {
    const { data: chap } = await supabase
      .from('chapters')
      .select('id, module_id')
      .eq('id', chapterId)
      .maybeSingle();
    if (!chap || chap.module_id !== moduleId) {
      return NextResponse.json({ error: 'chapter_not_in_module' }, { status: 400 });
    }
  }

  // Determine next num + position scoped to the resolved container (module or chapter).
  // Slug uniqueness is enforced at the course level (routing key) AND at the module level.
  const { data: courseLessons } = await supabase
    .from('lessons')
    .select('slug')
    .eq('course_id', course.id);
  const usedInCourse = new Set((courseLessons ?? []).map((l) => l.slug));

  const scopeQuery = supabase.from('lessons').select('num, position').eq('module_id', moduleId);
  const { data: scope } = chapterId
    ? await scopeQuery.eq('chapter_id', chapterId)
    : await scopeQuery.is('chapter_id', null);
  const nextNum = (scope ?? []).reduce((m, l) => Math.max(m, l.num), 0) + 1;
  const nextPos = (scope ?? []).reduce((m, l) => Math.max(m, l.position), -1) + 1;

  let candidate = slugify(title, `lesson-${nextNum}`);
  for (let i = 2; usedInCourse.has(candidate) && i < 50; i++) candidate = `${slugify(title, `lesson-${nextNum}`)}-${i}`;

  const { data: lesson, error } = await supabase
    .from('lessons')
    .insert({
      course_id: course.id,
      module_id: moduleId,
      chapter_id: chapterId,
      num: nextNum,
      slug: candidate,
      title,
      vimeo_id: body.vimeo_id ?? null,
      duration: body.duration ?? null,
      body: body.body ?? null,
      position: nextPos,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[lessons:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ lesson });
}
