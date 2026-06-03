import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const title: string | undefined = body.title;
  const url: string | undefined = body.url;
  if (!title || !url) return NextResponse.json({ error: 'title_and_url_required' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resources')
    .insert({
      owner_type: 'module',
      owner_id: id,
      title,
      url,
      size_mb: body.size_mb ?? null,
      kind: body.kind ?? 'link',
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ resource: data });
}
