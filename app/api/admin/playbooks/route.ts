import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { toSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { translateToSlug } from '@/lib/ai/slug-translate';

export async function POST(request: Request) {
  const { profile } = await requireAdmin();
  const body = await request.json().catch(() => ({}));

  const title = (body.title ?? '').toString().trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  const provided = (body.slug ?? '').toString().trim();
  const base = (provided ? toSlug(provided) : await translateToSlug(title)) || `playbook-${Date.now()}`;

  const supabase = createServiceClient();

  // De-dup slug
  const slug = await ensureUniqueSlug(base, async (c) => {
    const { count } = await supabase
      .from('playbooks')
      .select('id', { count: 'exact', head: true })
      .eq('slug', c);
    return (count ?? 0) > 0;
  });

  const insert = {
    source_type: 'manual' as const,
    source_id: null,
    slug,
    title,
    tagline: body.tagline ?? null,
    description: body.description ?? null,
    html_content: body.html_content ?? '',
    audience: body.audience ?? null,
    cover_url: body.cover_url ?? null,
    cover_style: body.cover_style ?? 'hero',
    video_url: body.video_url ?? null,
    domain: body.domain ?? null,
    tags: body.tags ?? [],
    status: 'draft' as const,
    is_premium: body.is_premium ?? false,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from('playbooks')
    .insert(insert)
    .select('*')
    .single();
  if (error) {
    console.error('[playbook:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }

  if (Array.isArray(body.category_ids) && body.category_ids.length > 0 && data) {
    const rows = body.category_ids
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .map((category_id: string) => ({ playbook_id: data.id, category_id }));
    if (rows.length > 0) {
      const { error: cErr } = await supabase.from('playbook_categories').insert(rows);
      if (cErr) console.error('[playbook:create:categories]', cErr);
    }
  }

  return NextResponse.json({ item: data });
}
