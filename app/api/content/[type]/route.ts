import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ContentType, GuideContentKind } from '@/lib/learn/types';
import { resolveWriteActor, validateContentUrl } from '@/lib/learn/content-write';

const VALID_TYPES: ContentType[] = ['course', 'guide', 'bundle'];

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[֐-׿]/g, '') // strip Hebrew chars for slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(request: Request, ctx: { params: Promise<{ type: string }> }) {
  const actor = await resolveWriteActor();
  if (actor.kind === 'none') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { type } = await ctx.params;
  if (!VALID_TYPES.includes(type as ContentType)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  // Creators may only create guides, owned by themselves.
  if (actor.kind === 'creator' && type !== 'guide') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  // Validate guide content_url against its kind.
  const contentKind = (body.content_kind ?? null) as GuideContentKind | null;
  const urlCheck = validateContentUrl(contentKind, body.content_url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: 'invalid_video_url', message: urlCheck.message }, { status: 400 });
  }

  let slug = (body.slug ?? '').trim() || slugify(title);
  if (!slug) slug = `untitled-${Date.now()}`;

  const supabase = await createClient();

  // Ensure uniqueness — append -2, -3 etc. if needed
  let candidate = slug;
  for (let n = 2; n < 50; n++) {
    const { count } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .eq('slug', candidate);
    if ((count ?? 0) === 0) break;
    candidate = `${slug}-${n}`;
  }

  // Creator is forced to own the row; admin may assign any creator_id.
  const creatorId =
    actor.kind === 'creator' ? actor.creatorId : (body.creator_id ?? null);
  // is_featured is admin-only.
  const isFeatured = actor.kind === 'admin' ? (body.is_featured ?? false) : false;

  const insert = {
    type,
    slug: candidate,
    title,
    tagline: body.tagline ?? null,
    description: body.description ?? null,
    cover_url: body.cover_url ?? null,
    cover_square_url: body.cover_square_url ?? null,
    cover_style: body.cover_style ?? 'hero',
    audience: body.audience ?? null,
    tags: body.tags ?? [],
    status: 'draft' as const,
    is_premium: body.is_premium ?? false,
    body: body.body ?? (type === 'guide' ? [] : null),
    created_by: actor.userId,
    updated_by: actor.userId,
    video_url: body.video_url ?? null,
    domain: body.domain ?? null,
    creator_id: creatorId,
    content_kind: type === 'guide' ? (contentKind ?? 'article') : null,
    content_url: urlCheck.value,
    duration_minutes: body.duration_minutes ?? null,
    is_featured: isFeatured,
    seo_title: body.seo_title ?? null,
    seo_description: body.seo_description ?? null,
    og_image_url: body.og_image_url ?? null,
  };

  const { data, error } = await supabase
    .from('content_items')
    .insert(insert)
    .select('*')
    .single();
  if (error) {
    console.error('[content:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }

  // Optional: attach categories on create
  if (Array.isArray(body.category_ids) && body.category_ids.length > 0 && data) {
    const rows = body.category_ids
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .map((category_id: string) => ({ content_item_id: data.id, category_id }));
    if (rows.length > 0) {
      const { error: cErr } = await supabase.from('content_item_categories').insert(rows);
      if (cErr) console.error('[content:create:categories]', cErr);
    }
  }

  return NextResponse.json({ item: data });
}
