import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActivePopupsForPath } from '@/lib/learn/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = (searchParams.get('path') || '/').trim() || '/';

  // Know whether the visitor is logged in (request-scoped, cookie-aware client).
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {
    /* treat as anonymous */
  }

  const items = await getActivePopupsForPath(path, isLoggedIn, new Date().toISOString());
  return NextResponse.json({ items });
}
