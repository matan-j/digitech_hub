import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const UPDATABLE_FIELDS = [
  'title',
  'slug',
  'tagline',
  'description',
  'html_content',
  'audience',
  'cover_url',
  'cover_style',
  'video_url',
  'domain',
  'tags',
  'status',
  'is_premium',
  // Access model (migration 018)
  'catalog_visibility',
  'access_level',
  'preview_enabled',
] as const;

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (update.status === 'published' && !('published_at' in body)) {
    update.published_at = new Date().toISOString();
  }

  const hasCategoryUpdate = Array.isArray(body.category_ids);
  if (Object.keys(update).length === 0 && !hasCategoryUpdate) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const supabase = createServiceClient();

  let updated;
  if (Object.keys(update).length > 0) {
    const { data, error } = await supabase
      .from('playbooks')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      console.error('[playbook:update]', error);
      return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
    }
    updated = data;
  } else {
    const { data } = await supabase.from('playbooks').select('*').eq('id', id).single();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    updated = data;
  }

  if (hasCategoryUpdate && updated) {
    const desired: string[] = (body.category_ids as unknown[])
      .filter((cid): cid is string => typeof cid === 'string' && cid.length > 0);

    const { error: dErr } = await supabase
      .from('playbook_categories')
      .delete()
      .eq('playbook_id', updated.id);
    if (dErr) console.error('[playbook:update:cats:delete]', dErr);

    if (desired.length > 0) {
      const rows = desired.map((category_id) => ({ playbook_id: updated.id, category_id }));
      const { error: iErr } = await supabase.from('playbook_categories').insert(rows);
      if (iErr) console.error('[playbook:update:cats:insert]', iErr);
    }
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('playbooks').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
