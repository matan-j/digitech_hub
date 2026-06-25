import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

const POPUPS_BUCKET = 'popups';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

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
    return NextResponse.json({ error: 'invalid_type', allowed: Array.from(ALLOWED) }, { status: 415 });
  }

  const key = `${randomUUID()}.${EXT[file.type] ?? 'png'}`;
  const svc = createServiceClient();
  const bytes = await file.arrayBuffer();
  const { error: upErr } = await svc.storage
    .from(POPUPS_BUCKET)
    .upload(key, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' });

  if (upErr) {
    return NextResponse.json({ error: 'upload_failed', message: upErr.message }, { status: 500 });
  }

  const { data: pub } = svc.storage.from(POPUPS_BUCKET).getPublicUrl(key);
  return NextResponse.json({ ok: true, url: pub.publicUrl, key });
}
