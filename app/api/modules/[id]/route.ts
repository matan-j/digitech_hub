import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const UPDATABLE = ['title', 'vimeo_id', 'duration', 'body', 'num', 'slug'] as const;

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const f of UPDATABLE) if (f in body) update[f] = body[f];
  if (!Object.keys(update).length) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('modules')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { error } = await supabase.from('modules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
