import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { DOMAIN_IDS, isDomainId } from '@/lib/learn/domains';
import { toSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { translateToSlug } from '@/lib/ai/slug-translate';

export async function GET() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('domain', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    return NextResponse.json({ error: 'fetch_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? '').toString().trim();
  const domain = (body.domain ?? '').toString().trim();
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (!isDomainId(domain)) {
    return NextResponse.json({ error: 'invalid_domain', allowed: DOMAIN_IDS }, { status: 400 });
  }

  const provided = (body.slug ?? '').toString().trim();
  const base = (provided ? toSlug(provided) : await translateToSlug(name)) || `cat-${Date.now()}`;

  const supabase = createServiceClient();

  // De-dup slug
  const slug = await ensureUniqueSlug(base, async (c) => {
    const { count } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('slug', c);
    return (count ?? 0) > 0;
  });

  const { data, error } = await supabase
    .from('categories')
    .insert({
      slug,
      name,
      domain,
      description: body.description ?? null,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    })
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
