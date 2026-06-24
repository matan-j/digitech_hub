// ============================================================
// GET /api/account/orders/[id]
// Full detail for a single purchase ("purchase card" popup). `[id]` is the
// public_order_id. Authorized for the order OWNER or any ADMIN. Re-fetches the
// live payment data from SUMIT so the card shows everything (status, auth number,
// payment date, amount/currency as SUMIT recorded it).
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrderByPublicId } from '@/lib/payments/order-service';
import { isSumitConfigured, sumitGetPayment } from '@/lib/payments/sumit';

export const runtime = 'nodejs';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: publicOrderId } = await ctx.params;
  const order = await getOrderByPublicId(publicOrderId);
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const isOwner = order.user_id === auth.userId;
  const isAdmin = auth.profile.role === 'admin';
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = createServiceClient();
  const [{ data: content }, { data: profile }, userRes] = await Promise.all([
    supabase.from('content_items').select('title, slug').eq('id', order.content_id).maybeSingle(),
    supabase.from('profiles').select('full_name, phone').eq('id', order.user_id).maybeSingle(),
    supabase.auth.admin.getUserById(order.user_id),
  ]);

  // Live payment data (best-effort — the card still renders without it).
  let payment = null;
  if (order.provider_transaction_id && isSumitConfigured()) {
    try {
      const p = await sumitGetPayment(order.provider_transaction_id);
      payment = {
        valid: p.valid,
        status: p.status,
        statusDescription: p.statusDescription,
        authNumber: p.authNumber,
        paymentDate: p.paymentDate,
        amount: p.amount,
        currency: p.currency,
        customerId: p.customerId,
        transactionId: p.transactionId,
      };
    } catch (e) {
      console.error('[orders:detail] sumitGetPayment failed', publicOrderId, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    order: {
      public_order_id: order.public_order_id,
      status: order.status,
      provider: order.provider,
      created_at: order.created_at,
      updated_at: order.updated_at,
      amount: Number(order.amount),
      original_amount: order.original_amount != null ? Number(order.original_amount) : null,
      currency: order.currency,
      content_type: order.content_type,
      product_title: (content?.title as string | null) ?? '(תוכן נמחק)',
      provider_transaction_id: order.provider_transaction_id,
      document_id: order.document_id,
      has_invoice: Boolean(order.document_url || order.document_id),
    },
    customer: {
      name: (profile?.full_name as string | null) ?? null,
      email: userRes.data?.user?.email ?? null,
      phone: (profile?.phone as string | null) ?? null,
    },
    payment,
  });
}
