import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sanitizePopup } from '../_sanitize';

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const fields = sanitizePopup(body, true);

  if ('name' in fields && !fields.name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (fields.scope === 'page' && 'target_path' in fields && !fields.target_path) {
    return NextResponse.json({ error: 'target_path_required' }, { status: 400 });
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('popups')
    .update(fields)
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
  const { error } = await supabase.from('popups').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
