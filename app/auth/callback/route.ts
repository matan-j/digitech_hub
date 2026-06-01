import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic-link / OAuth callback. Supabase Auth redirects here after verifying
 * the user's identity, with either:
 *   - `code` (PKCE / OAuth)   → exchangeCodeForSession
 *   - `token_hash` + `type`   → verifyOtp (legacy magic-link flow)
 *
 * Any failure must redirect to /login with an explicit error string —
 * never throw, never return 500. A 500 here looks identical to "the site
 * is broken" from the user's perspective and gives us no information.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/learn';

  const fail = (reason: string, detail?: string) => {
    console.error('[auth/callback] failed:', reason, detail ?? '');
    const url = new URL('/login', origin);
    url.searchParams.set('error', reason);
    if (detail) url.searchParams.set('detail', detail);
    return NextResponse.redirect(url);
  };

  if (!code && !token_hash) {
    return fail('missing_params');
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail('exchange_failed', error.message);
      return NextResponse.redirect(`${origin}${safeNext(next)}`);
    }

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        token_hash,
      });
      if (error) return fail('verify_failed', error.message);
      return NextResponse.redirect(`${origin}${safeNext(next)}`);
    }

    return fail('missing_type', 'token_hash present but no type');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('callback_crashed', message);
  }
}

/**
 * Prevent open-redirects via the `next` query parameter — only allow local
 * paths starting with `/` and not pointing at another origin.
 */
function safeNext(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/learn';
  return value;
}
