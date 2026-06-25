import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { makeSquareFromUpload } from '@/lib/images/square-cover';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Bucket = 'covers' | 'resources';

const COVER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const RESOURCE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const MAX_SIZE: Record<Bucket, number> = {
  covers: 5 * 1024 * 1024,
  resources: 50 * 1024 * 1024,
};

function inferKind(mime: string): 'pdf' | 'xlsx' | 'docx' | 'link' | undefined {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx';
  if (mime.includes('wordprocessing') || mime === 'application/msword') return 'docx';
  return undefined;
}

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'file';
}

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData();
  const file = form.get('file');
  const bucketRaw = form.get('bucket');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const bucket = bucketRaw === 'resources' ? 'resources' : 'covers' as Bucket;
  const allowed = bucket === 'covers' ? COVER_TYPES : RESOURCE_TYPES;
  if (!allowed.has(file.type)) {
    return NextResponse.json({ error: 'unsupported_mime', mime: file.type }, { status: 415 });
  }
  if (file.size > MAX_SIZE[bucket]) {
    return NextResponse.json({ error: 'file_too_large', limit: MAX_SIZE[bucket] }, { status: 413 });
  }

  const supabase = createServiceClient();
  const path = `${Date.now()}_${safeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    console.error('[upload] failed', upErr);
    return NextResponse.json({ error: 'upload_failed', message: upErr.message }, { status: 500 });
  }

  let publicUrl: string | null = null;
  let squareUrl: string | null = null;
  if (bucket === 'covers') {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    publicUrl = data.publicUrl;
    // Precompute the 1:1 crop used by the purchase webhook (skipped for SVG /
    // anything sharp can't rasterise — makeSquareFromUpload returns null, and the
    // purchase-time fallback can still generate it later).
    if (file.type !== 'image/svg+xml') {
      const square = await makeSquareFromUpload(buffer, path);
      squareUrl = square?.url ?? null;
    }
  } else {
    // Private bucket — return a signed URL valid for 1 year (resources stay private)
    const { data, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr) {
      return NextResponse.json({ error: 'sign_url_failed', message: sErr.message }, { status: 500 });
    }
    publicUrl = data.signedUrl;
  }

  return NextResponse.json({
    bucket,
    path,
    url: publicUrl,
    squareUrl,
    size: file.size,
    sizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
    mime: file.type,
    kind: inferKind(file.type),
  });
}
