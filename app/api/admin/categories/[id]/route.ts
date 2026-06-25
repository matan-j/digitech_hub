import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isDomainId } from '@/lib/learn/domains';

const UPDATABLE = ['name', 'description', 'sort_order', 'domain'] as const;

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE) {
    if (field in body) update[field] = body[field];
  }
  if ('domain' in update && !isDomainId(update.domain)) {
    return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
