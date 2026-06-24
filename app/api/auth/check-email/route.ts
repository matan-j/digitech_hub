import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/check-email { email }
 *   -> { exists, providers, hasPassword, hasGoogle, reason }
 *
 * Trusted lookup used by the signup forms to BLOCK a second account under a
 * different method (see migration 028). Runs with the service key + a
 * SECURITY DEFINER function so the browser never reads auth.users directly.
 *
 * Fail-OPEN by design: if the lookup errors we return "no existing account"
 * rather than a 500, so a transient DB hiccup can never lock a real user out of
 * signing up. Supabase's own unique-email enforcement remains the backstop.
 *
 * `reason` is a non-sensitive diagnostic so we can tell WHY a lookup came back
 * empty (env / migration / data) by inspecting the Network response — without
 * leaking the actual account details.
 */
export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: unknown };

  const empty = (reason: string) => ({
    exists: false,
    providers: [] as string[],
    hasPassword: false,
    hasGoogle: false,
    reason,
  });

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json(empty('invalid_email'));
  }

  // The guard is inert without the service key — surface it loudly instead of
  // silently letting every signup through.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[auth/check-email] SUPABASE_SERVICE_ROLE_KEY is not set — cross-provider guard is DISABLED (fail-open).',
    );
    return NextResponse.json(empty('no_service_key'));
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('email_auth_providers', {
      p_email: email.trim(),
    });
    if (error) {
      // Most likely: migration 028 not applied, or no EXECUTE grant.
      console.error('[auth/check-email] rpc error:', error.message);
      return NextResponse.json(empty('rpc_error'));
    }
    const row = (data ?? {}) as { providers?: string[]; has_password?: boolean };
    const providers = (row.providers ?? []).filter(Boolean);
    return NextResponse.json({
      exists: providers.length > 0,
      providers,
      // Real password set — NOT merely the presence of an 'email' identity,
      // which OTP/magic-link also creates.
      hasPassword: row.has_password === true,
      hasGoogle: providers.includes('google'),
      reason: providers.length ? 'ok' : 'no_match',
    });
  } catch (err) {
    console.error('[auth/check-email] crashed', err);
    return NextResponse.json(empty('exception'));
  }
}
