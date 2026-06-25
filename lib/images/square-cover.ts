// ============================================================
// lib/images/square-cover.ts
// 1:1 (square) cover generation for the purchase webhook image.
//
// Covers are cropped ONCE — at upload time (app/api/upload) — and the resulting
// public URL is cached on content_items.cover_square_url (migration 035). The
// purchase flow (quick-buy + cart) reads that column; if it's empty (a cover
// uploaded before this feature), ensureSquareCoverUrl() lazily crops + stores it
// on first use, so Make/GROW always receives a square image link.
//
// Server-only: uses sharp + the storage service client. Never import in the browser.
// ============================================================

import 'server-only';
import sharp from 'sharp';
import { createServiceClient } from '@/lib/supabase/server';

const COVERS_BUCKET = 'covers';
const SQUARE_SIZE = 800; // px — generous for cards/emails, still light as JPEG.

/** Center-crop any raster image to a SQUARE_SIZE×SQUARE_SIZE JPEG (white matte). */
export async function cropToSquareJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honour EXIF orientation before cropping
    .resize(SQUARE_SIZE, SQUARE_SIZE, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' }) // drop transparency → solid for emails
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** Upload a square JPEG buffer to the public covers bucket; return its public URL. */
async function uploadSquare(buffer: Buffer, objectPath: string): Promise<string> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(objectPath, buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`square upload failed: ${error.message}`);
  return supabase.storage.from(COVERS_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

/**
 * Crop an already-uploaded cover buffer to a square sibling and return its URL.
 * Used by the upload route to precompute the square at upload time. The square
 * lives under `squares/<originalPath>.jpg` in the same bucket. Returns null if
 * cropping fails (e.g. an SVG sharp can't rasterise) — the caller keeps the
 * original cover and the purchase-time fallback can retry later.
 */
export async function makeSquareFromUpload(
  originalBuffer: Buffer,
  originalPath: string,
): Promise<{ path: string; url: string } | null> {
  try {
    const square = await cropToSquareJpeg(originalBuffer);
    const path = `squares/${originalPath}.jpg`;
    const url = await uploadSquare(square, path);
    return { path, url };
  } catch (e) {
    console.error('[square-cover] makeSquareFromUpload failed', originalPath, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Resolve the square cover URL for a content item, generating + caching it on
 * first use. Order:
 *   1. coverSquareUrl already set → return it (the fast path).
 *   2. no coverUrl → null (nothing to send).
 *   3. fetch the original, crop, upload, persist content_items.cover_square_url,
 *      return the new URL.
 * On any failure falls back to the original coverUrl, so the webhook still gets
 * an image (just not square) rather than nothing.
 */
export async function ensureSquareCoverUrl(item: {
  id: string;
  coverUrl: string | null;
  coverSquareUrl: string | null;
}): Promise<string | null> {
  if (item.coverSquareUrl) return item.coverSquareUrl;
  if (!item.coverUrl) return null;

  try {
    const res = await fetch(item.coverUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`fetch cover ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());
    const square = await cropToSquareJpeg(original);
    const url = await uploadSquare(square, `squares/by-id/${item.id}.jpg`);

    const supabase = createServiceClient();
    await supabase.from('content_items').update({ cover_square_url: url }).eq('id', item.id);
    return url;
  } catch (e) {
    console.error('[square-cover] ensureSquareCoverUrl failed', item.id, e instanceof Error ? e.message : e);
    return item.coverUrl; // fallback: original cover is better than no image
  }
}
