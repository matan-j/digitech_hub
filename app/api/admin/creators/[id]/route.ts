import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const UPDATABLE = [
  'name',
  'avatar_url',
  'banner_url',
  'bio',
  'role_title',
  'intro_video_url',
  'website',
  'linkedin',
  'instagram',
  'youtube',
  'tiktok',
  'email',
  'contact_email',
  'user_id',
  'status',
  'is_featured',
  'sort_order',
  'seo_title',
  'seo_description',
  'og_image_url',
] as const;

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { profile } = await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const f of UPDATABLE) {
    if (f in body) update[f] = body[f] === '' && f === 'user_id' ? null : body[f];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }
  update.updated_by = profile.id;

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('creators').update(update).eq('id', id).select('*').single();
  if (error) {
    console.error('[creators:update]', error);
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  // When an active user is assigned, auto-grant the creator role (don't demote admins).
  if ('user_id' in update && update.user_id) {
    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role: 'creator' })
      .eq('id', update.user_id as string)
      .neq('role', 'admin');
    if (roleErr) console.error('[creators:update:role]', roleErr);
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('creators').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
