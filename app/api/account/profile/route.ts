import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  validateHebrewFullName,
  validateIsraeliPhone,
  normalizeFullName,
} from '@/lib/validation/profile';

/**
 * PATCH /api/account/profile { full_name, phone }
 *
 * Authenticated. The single write path for a user's contact details — used by
 * the profile-completion popup AND the account settings card. Validation here
 * is authoritative (the client validates for UX; the server validates for
 * integrity), so a bad name/phone can never reach the DB or the purchase
 * webhook regardless of how the request was crafted.
 *
 * RLS-safe: only touches `full_name` / `phone`, which a user may update on
 * their own row, so no service key is needed.
 */
export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    full_name?: unknown;
    phone?: unknown;
  };

  const patch: Record<string, unknown> = {};
  const fieldErrors: { full_name?: string; phone?: string } = {};

  if (typeof body.full_name === 'string') {
    const r = validateHebrewFullName(body.full_name);
    if (!r.valid) fieldErrors.full_name = r.error;
    else patch.full_name = normalizeFullName(body.full_name);
  }

  if (typeof body.phone === 'string') {
    const r = validateIsraeliPhone(body.phone);
    if (!r.valid) fieldErrors.phone = r.error;
    else patch.phone = r.value;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'validation', fieldErrors }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  patch.last_activity_at = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.userId);

  if (error) {
    console.error('[account/profile]', error);
    return NextResponse.json({ error: 'save_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    full_name: (patch.full_name as string) ?? null,
    phone: (patch.phone as string) ?? null,
  });
}
