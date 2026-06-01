import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign the user out. POST-only on purpose — a GET handler here would be
 * triggered by Next.js link prefetching the moment a logout button rendered
 * on screen, silently destroying the session and bouncing the user to /login
 * on their very next click. POSTs aren't prefetched.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/learn', request.url), { status: 303 });
}
