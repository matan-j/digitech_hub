// ============================================================
// /api/admin/coupons/[id] — single coupon (detail / update / delete).
//   GET    → coupon + its linked product ids + customer ids.
//   PATCH  → update fields + replace product / customer links.
//   DELETE → remove the coupon (links + redemptions cascade; orders keep the
//            coupon_code text snapshot via ON DELETE SET NULL).
// Admin-only.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { parseCoupon } from '@/lib/payments/coupon-admin';

export const runtime = 'nodejs';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = createServiceClient();

  const [{ data: coupon }, { data: products }, { data: customers }] = await Promise.all([
    supabase.from('coupons').select('*').eq('id', id).maybeSingle(),
    supabase.from('coupon_products').select('content_id').eq('coupon_id', id),
    supabase.from('coupon_customers').select('user_id').eq('coupon_id', id),
  ]);
  if (!coupon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    coupon,
    product_ids: (products ?? []).map((p) => p.content_id as string),
    customer_ids: (customers ?? []).map((c) => c.user_id as string),
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = parseCoupon(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('coupons').update(parsed.row).eq('id', id);
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'code_taken' : 'update_failed', message: error.message }, { status: dup ? 409 : 500 });
  }

  // Replace the product + customer links wholesale (simple + idempotent).
  await supabase.from('coupon_products').delete().eq('coupon_id', id);
  if (parsed.productIds.length) {
    await supabase.from('coupon_products').insert(
      parsed.productIds.map((content_id) => ({ coupon_id: id, content_id, content_type: 'course' })),
    );
  }
  await supabase.from('coupon_customers').delete().eq('coupon_id', id);
  if (parsed.customerIds.length) {
    await supabase.from('coupon_customers').insert(
      parsed.customerIds.map((user_id) => ({ coupon_id: id, user_id })),
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
