import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { toSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { translateToSlug } from '@/lib/ai/slug-translate';

const SOCIAL_FIELDS = ['website', 'linkedin', 'instagram', 'youtube', 'tiktok', 'email', 'contact_email'] as const;

export async function POST(request: Request) {
  const { profile } = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? '').toString().trim();
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const provided = (body.slug ?? '').toString().trim();
  const slugBase = (provided ? toSlug(provided) : await translateToSlug(name)) || `creator-${Date.now()}`;

  const supabase = await createClient();

  // De-dup slug
  const slug = await ensureUniqueSlug(slugBase, async (c) => {
    const { count } = await supabase
      .from('creators')
      .select('id', { count: 'exact', head: true })
      .eq('slug', c);
    return (count ?? 0) > 0;
  });

  const insert: Record<string, unknown> = {
    slug,
    name,
    avatar_url: body.avatar_url ?? null,
    banner_url: body.banner_url ?? null,
    bio: body.bio ?? null,
    role_title: body.role_title ?? null,
    intro_video_url: body.intro_video_url ?? null,
    user_id: body.user_id || null,
    status: body.status === 'disabled' ? 'disabled' : 'active',
    is_featured: body.is_featured ?? false,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    seo_title: body.seo_title ?? null,
    seo_description: body.seo_description ?? null,
    og_image_url: body.og_image_url ?? null,
    created_by: profile.id,
    updated_by: profile.id,
  };
  for (const f of SOCIAL_FIELDS) insert[f] = body[f] ?? null;

  const { data, error } = await supabase.from('creators').insert(insert).select('*').single();
  if (error) {
    console.error('[creators:create]', error);
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }

  // Auto-grant the creator role to the assigned user (don't demote admins).
  if (insert.user_id) {
    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role: 'creator' })
      .eq('id', insert.user_id)
      .neq('role', 'admin');
    if (roleErr) console.error('[creators:create:role]', roleErr);
  }

  return NextResponse.json({ item: data });
}
