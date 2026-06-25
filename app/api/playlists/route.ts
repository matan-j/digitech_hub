import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteActor } from '@/lib/learn/content-write';
import { toSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { translateToSlug } from '@/lib/ai/slug-translate';

export async function POST(request: Request) {
  const actor = await resolveWriteActor();
  if (actor.kind === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = (body.title ?? '').toString().trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  // Creator owns the playlist; admin must specify creator_id.
  const creatorId = actor.kind === 'creator' ? actor.creatorId : (body.creator_id ?? null);
  if (!creatorId) return NextResponse.json({ error: 'creator_required' }, { status: 400 });

  const supabase = await createClient();

  const provided = (body.slug ?? '').toString().trim();
  const slugBase = (provided ? toSlug(provided) : await translateToSlug(title)) || `playlist-${Date.now()}`;
  const slug = await ensureUniqueSlug(slugBase, async (c) => {
    const { count } = await supabase
      .from('playlists')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('slug', c);
    return (count ?? 0) > 0;
  });

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      creator_id: creatorId,
      slug,
      title,
      description: body.description ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      domain: body.domain ?? null,
      status: 'draft',
      is_featured: actor.kind === 'admin' ? (body.is_featured ?? false) : false,
      sort_order: actor.kind === 'admin' && typeof body.sort_order === 'number' ? body.sort_order : 0,
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[playlists:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
