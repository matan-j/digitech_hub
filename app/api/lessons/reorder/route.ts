import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Reorder lessons within a container (module OR chapter).
 * Payload: { ordered_ids: string[], scope?: { module_id: string; chapter_id: string | null } }
 *
 * If scope is provided, the batch is validated: every id must belong to that container.
 * If omitted (legacy callers from before the module hierarchy), we accept and renumber
 * blindly — only callable by admin, so blast radius is bounded.
 */
export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const orderedIds: string[] | undefined = body.ordered_ids;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'ordered_ids_required' }, { status: 400 });
  }

  const scope: { module_id?: string; chapter_id?: string | null } | undefined = body.scope;

  const admin = createServiceClient();

  if (scope?.module_id) {
    const { data: existing } = await admin
      .from('lessons')
      .select('id, module_id, chapter_id')
      .in('id', orderedIds);
    const byId = new Map((existing ?? []).map((l) => [l.id, l]));
    for (const id of orderedIds) {
      const l = byId.get(id);
      if (!l) return NextResponse.json({ error: 'lesson_not_found', id }, { status: 400 });
      if (l.module_id !== scope.module_id) {
        return NextResponse.json({ error: 'cross_module_reorder_rejected', id }, { status: 400 });
      }
      const wantChapter = scope.chapter_id ?? null;
      if ((l.chapter_id ?? null) !== wantChapter) {
        return NextResponse.json({ error: 'cross_chapter_reorder_rejected', id }, { status: 400 });
      }
    }
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await admin
      .from('lessons')
      .update({ position: i, num: i + 1 })
      .eq('id', orderedIds[i]);
    if (error) {
      return NextResponse.json({ error: 'reorder_failed', message: error.message, at: i }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
