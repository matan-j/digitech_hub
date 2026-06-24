import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserPurchases } from '@/lib/payments/purchase-history';

export const runtime = 'nodejs';

// GET -> the authenticated user's own purchase history (all attempts).
export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const purchases = await getUserPurchases(auth.userId);
  return NextResponse.json({ purchases });
}
