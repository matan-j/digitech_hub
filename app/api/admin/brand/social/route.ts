import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { SocialKey } from '@/lib/brand';

const KEYS: readonly SocialKey[] = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'x',
  'website',
];

function sanitize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept URLs only — reject anything that isn't a parseable URL.
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function requireAdminOrNull() {
  const supa = createServiceClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return null;
  return { supa, user };
}

export async function PATCH(req: Request) {
  const ctx = await requireAdminOrNull();
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Partial<Record<SocialKey, unknown>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Build an update payload of only the columns explicitly provided.
  const update: Record<string, string | null> = {};
  for (const key of KEYS) {
    if (key in body) {
      update[`social_${key}`] = sanitize(body[key]);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const { error } = await ctx.supa
    .from('brand_settings')
    .update(update)
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(update) });
}
