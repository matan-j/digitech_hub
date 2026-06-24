import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/check-email { email } -> { exists, providers, hasPassword, hasGoogle }
 *
 * Trusted lookup used by the signup forms to BLOCK a second account under a
 * different method (see migration 028). Runs with the service key + a
 * SECURITY DEFINER function so the browser never reads auth.users directly.
 *
 * Fail-OPEN by design: if the lookup errors we return "no existing account"
 * rather than a 500, so a transient DB hiccup can never lock a real user out of
 * signing up. Supabase's own unique-email enforcement remains the backstop.
 */
export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: unknown };

  const empty = { exists: false, providers: [], hasPassword: false, hasGoogle: false };

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json(empty);
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('email_auth_providers', {
      p_email: email.trim(),
    });
    if (error) {
      console.error('[auth/check-email]', error);
      return NextResponse.json(empty);
    }
    const providers = ((data as string[] | null) ?? []).filter(Boolean);
    return NextResponse.json({
      exists: providers.length > 0,
      providers,
      hasPassword: providers.includes('email'),
      hasGoogle: providers.includes('google'),
    });
  } catch (err) {
    console.error('[auth/check-email] crashed', err);
    return NextResponse.json(empty);
  }
}
