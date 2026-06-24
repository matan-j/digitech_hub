import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET ?order=DGH-XXXX -> { status, entitled }
// Polled by /payment/success while the webhook settles. Reads via RLS so a user
// only sees their own order + entitlement.
export async function GET(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const publicOrderId = searchParams.get('order');
  if (!publicOrderId) return NextResponse.json({ error: 'order_required' }, { status: 400 });

  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('status, content_type, content_id')
    .eq('public_order_id', publicOrderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let entitled = false;
  if (order.status === 'paid') {
    const { data: ent } = await supabase
      .from('entitlements')
      .select('id')
      .eq('user_id', auth.userId)
      .eq('resource_type', order.content_type)
      .eq('resource_id', order.content_id)
      .eq('status', 'active')
      .maybeSingle();
    entitled = !!ent;
  }

  return NextResponse.json({ status: order.status, entitled });
}
