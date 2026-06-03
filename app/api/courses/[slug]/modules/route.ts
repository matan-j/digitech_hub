import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function slugify(input: string, fallback = 'module'): string {
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

  const { data: existing } = await supabase
    .from('modules')
    .select('num, position, slug')
    .eq('course_id', course.id);
  const used = new Set((existing ?? []).map((m) => m.slug));
  const nextNum = (existing ?? []).reduce((m, x) => Math.max(m, x.num), 0) + 1;
  const nextPos = (existing ?? []).reduce((m, x) => Math.max(m, x.position), -1) + 1;

  let candidate = slugify(title, `module-${nextNum}`);
  for (let i = 2; used.has(candidate) && i < 50; i++) candidate = `${slugify(title, `module-${nextNum}`)}-${i}`;

  const { data: created, error } = await supabase
    .from('modules')
    .insert({
      course_id: course.id,
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
    console.error('[modules:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ module: created });
}
