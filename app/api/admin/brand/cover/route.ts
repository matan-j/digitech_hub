import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { BRAND_BUCKET, BRAND_COVER_PREFIX } from '@/lib/brand';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — covers are bigger than logos
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

async function requireAdminOrNull() {
  const supa = createServiceClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(req: Request) {
  const admin = await requireAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: 'invalid_type', allowed: Array.from(ALLOWED) },
      { status: 415 },
    );
  }

  const ext = file.type === 'image/jpeg' ? 'jpg'
    : file.type === 'image/webp' ? 'webp'
    : 'png';
  const key = `${BRAND_COVER_PREFIX}.${ext}`;

  const svc = createServiceClient();

  // Wipe previous covers of any extension to keep only one.
  const { data: existing } = await svc.storage.from(BRAND_BUCKET).list('', { limit: 50 });
  const toRemove = (existing ?? [])
    .filter((f) => f.name.startsWith(BRAND_COVER_PREFIX) && f.name !== key)
    .map((f) => f.name);
  if (toRemove.length) {
    await svc.storage.from(BRAND_BUCKET).remove(toRemove);
  }

  const bytes = await file.arrayBuffer();
  const { error: upErr } = await svc.storage
    .from(BRAND_BUCKET)
    .upload(key, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: '60',
    });

  if (upErr) {
    return NextResponse.json({ error: 'upload_failed', message: upErr.message }, { status: 500 });
  }

  const { data: pub } = svc.storage.from(BRAND_BUCKET).getPublicUrl(key);
  return NextResponse.json({ ok: true, url: pub.publicUrl, key });
}

export async function DELETE() {
  const admin = await requireAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const svc = createServiceClient();
  const { data: existing } = await svc.storage.from(BRAND_BUCKET).list('', { limit: 50 });
  const toRemove = (existing ?? [])
    .filter((f) => f.name.startsWith(BRAND_COVER_PREFIX))
    .map((f) => f.name);
  if (toRemove.length) {
    const { error } = await svc.storage.from(BRAND_BUCKET).remove(toRemove);
    if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, removed: toRemove });
}
