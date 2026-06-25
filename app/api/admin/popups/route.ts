import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sanitizePopup } from './_sanitize';

export async function GET() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('popups')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: 'fetch_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const fields = sanitizePopup(body, false);

  if (!fields.name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (fields.scope === 'page' && !fields.target_path) {
    return NextResponse.json({ error: 'target_path_required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('popups').insert(fields).select('*').single();
  if (error) {
    return NextResponse.json({ error: 'create_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
