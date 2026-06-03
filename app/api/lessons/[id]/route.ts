import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const UPDATABLE = ['title', 'vimeo_id', 'duration', 'body', 'num', 'slug', 'module_id', 'chapter_id'] as const;

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const f of UPDATABLE) if (f in body) update[f] = body[f];
  if (!Object.keys(update).length) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const supabase = await createClient();

  // If admin is reparenting (module_id or chapter_id changes), append the lesson at
  // the END of the new container — compute next position/num so it doesn't collide
  // with whatever's already there.
  const parentChanging = 'module_id' in update || 'chapter_id' in update;
  if (parentChanging) {
    const { data: current } = await supabase
      .from('lessons')
      .select('module_id, chapter_id, course_id')
      .eq('id', id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: 'lesson_not_found' }, { status: 404 });
    }
    const targetModuleId = ('module_id' in update ? (update.module_id as string | null) : current.module_id) as string;
    const targetChapterId = ('chapter_id' in update ? (update.chapter_id as string | null) : (current.chapter_id as string | null));

    // Validate the target chapter (if provided) belongs to the target module
    if (targetChapterId) {
      const { data: chap } = await supabase.from('chapters').select('module_id').eq('id', targetChapterId).maybeSingle();
      if (!chap || chap.module_id !== targetModuleId) {
        return NextResponse.json({ error: 'chapter_not_in_module' }, { status: 400 });
      }
    }

    const scopeQuery = supabase
      .from('lessons')
      .select('num, position')
      .eq('module_id', targetModuleId)
      .neq('id', id);
    const { data: scope } = targetChapterId
      ? await scopeQuery.eq('chapter_id', targetChapterId)
      : await scopeQuery.is('chapter_id', null);
    const nextNum = (scope ?? []).reduce((m, l) => Math.max(m, l.num), 0) + 1;
    const nextPos = (scope ?? []).reduce((m, l) => Math.max(m, l.position), -1) + 1;
    update.num = nextNum;
    update.position = nextPos;
  }

  const { data, error } = await supabase
    .from('lessons')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ lesson: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
