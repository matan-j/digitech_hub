import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteActor, type WriteActor } from '@/lib/learn/content-write';

const BASE_FIELDS = [
  'title',
  'description',
  'thumbnail_url',
  'domain',
  'status',
  'seo_title',
  'seo_description',
  'og_image_url',
  // Access model (migration 018)
  'catalog_visibility',
] as const;
const ADMIN_ONLY = ['is_featured', 'sort_order'] as const;

function authorize(actor: WriteActor, creatorId: string | null): boolean {
  if (actor.kind === 'admin') return true;
  if (actor.kind === 'creator') return !!creatorId && creatorId === actor.creatorId;
  return false;
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await resolveWriteActor();
  if (actor.kind === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: existing, error: fErr } = await supabase
    .from('playlists')
    .select('id, creator_id')
    .eq('id', id)
    .single();
  if (fErr || !existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!authorize(actor, (existing as { creator_id: string | null }).creator_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const f of BASE_FIELDS) if (f in body) update[f] = body[f];
  if (actor.kind === 'admin') for (const f of ADMIN_ONLY) if (f in body) update[f] = body[f];
  if (update.status === 'published' && !('published_at' in body)) {
    update.published_at = new Date().toISOString();
  }
  update.updated_by = actor.userId;

  if (Object.keys(update).length > 1) {
    const { error } = await supabase.from('playlists').update(update).eq('id', id);
    if (error) {
      console.error('[playlists:update]', error);
      return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
    }
  }

  // Sync ordered items if provided: full replace in given order.
  if (Array.isArray(body.content_item_ids)) {
    const ids: string[] = (body.content_item_ids as unknown[]).filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    );
    const { error: dErr } = await supabase.from('playlist_items').delete().eq('playlist_id', id);
    if (dErr) console.error('[playlists:items:delete]', dErr);
    if (ids.length > 0) {
      const rows = ids.map((content_item_id, i) => ({
        playlist_id: id,
        content_item_id,
        sort_order: (i + 1) * 10,
      }));
      const { error: iErr } = await supabase.from('playlist_items').insert(rows);
      if (iErr) console.error('[playlists:items:insert]', iErr);
    }
  }

  const { data: updated } = await supabase.from('playlists').select('*').eq('id', id).single();
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await resolveWriteActor();
  if (actor.kind === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: existing, error: fErr } = await supabase
    .from('playlists')
    .select('id, creator_id')
    .eq('id', id)
    .single();
  if (fErr || !existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!authorize(actor, (existing as { creator_id: string | null }).creator_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('playlists').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
