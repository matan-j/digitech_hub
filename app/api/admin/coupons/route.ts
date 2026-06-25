// ============================================================
// /api/admin/coupons — admin coupon management (list + create).
//   GET  → all coupons with their usage counts.
//   POST → create a coupon (+ product / customer links).
// Admin-only (requireAdmin). All writes via the service client.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { parseCoupon, type CouponInput } from '@/lib/payments/coupon-admin';

export const runtime = 'nodejs';

export async function GET() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [{ data: coupons }, { data: redemptions }] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('coupon_redemptions').select('coupon_id'),
  ]);

  const usage = new Map<string, number>();
  for (const r of redemptions ?? []) {
    const id = (r as { coupon_id: string }).coupon_id;
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  const rows = (coupons ?? []).map((c) => ({ ...c, usage_count: usage.get(c.id as string) ?? 0 }));
  return NextResponse.json({ coupons: rows });
}

export async function POST(request: Request) {
  const { userId } = await requireAdmin();
  const body = (await request.json().catch(() => ({}))) as CouponInput;
  const parsed = parseCoupon(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceClient();
  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert({ ...parsed.row, created_by: userId })
    .select('id')
    .single();
  if (error) {
    const dup = error.code === '23505'; // unique_violation on code
    return NextResponse.json({ error: dup ? 'code_taken' : 'create_failed', message: error.message }, { status: dup ? 409 : 500 });
  }

  const couponId = coupon.id as string;
  if (parsed.productIds.length) {
    await supabase.from('coupon_products').insert(
      parsed.productIds.map((content_id) => ({ coupon_id: couponId, content_id, content_type: 'course' })),
    );
  }
  if (parsed.customerIds.length) {
    await supabase.from('coupon_customers').insert(
      parsed.customerIds.map((user_id) => ({ coupon_id: couponId, user_id })),
    );
  }

  return NextResponse.json({ ok: true, id: couponId });
}
