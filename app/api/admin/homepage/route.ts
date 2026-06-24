import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSections } from '@/lib/learn/homepage';
import { getHomepageConfig } from '@/lib/learn/homepage-server';

export async function GET() {
  await requireAdmin();
  const sections = await getHomepageConfig();
  return NextResponse.json({ sections });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const sections = sanitizeSections(body?.sections);
  if (sections.length === 0) {
    return NextResponse.json({ error: 'no_valid_sections' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('homepage_config')
    .update({ sections, updated_by: admin.userId })
    .eq('id', 1)
    .select('sections')
    .single();
  if (error) {
    console.error('[homepage:update]', error);
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: (data as { sections: unknown }).sections });
}
