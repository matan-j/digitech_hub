import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const orderedIds: string[] | undefined = body.ordered_ids;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'ordered_ids_required' }, { status: 400 });
  }

  const admin = createServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await admin
      .from('chapters')
      .update({ position: i, num: i + 1 })
      .eq('id', orderedIds[i]);
    if (error) {
      return NextResponse.json({ error: 'reorder_failed', message: error.message, at: i }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
