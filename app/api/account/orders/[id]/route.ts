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
  const [{ data: content }, { data: profile }, userRes, { data: orderItems }] = await Promise.all([
    supabase.from('content_items').select('title, slug').eq('id', order.content_id).maybeSingle(),
    supabase.from('profiles').select('full_name, phone').eq('id', order.user_id).maybeSingle(),
    supabase.auth.admin.getUserById(order.user_id),
    supabase
      .from('order_items')
      .select('content_id, product_title, cover_url, price_before, price_after')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
  ]);

  // A multi-item ("bundle") order lists its lines; a single-item order has none.
  const products = (orderItems ?? []).map((p) => ({
    content_id: p.content_id as string,
    title: (p.product_title as string | null) ?? '(תוכן נמחק)',
    cover_url: (p.cover_url as string | null) ?? null,
    price_before: p.price_before != null ? Number(p.price_before) : null,
    price_after: p.price_after != null ? Number(p.price_after) : null,
  }));
  const productTitle =
    order.content_type === 'bundle'
      ? products.length <= 2
        ? products.map((p) => p.title).join(' + ') || 'סל קניות'
        : `${products.length} מוצרים`
      : (content?.title as string | null) ?? '(תוכן נמחק)';

  // Live SUMIT payment data (only for SUMIT orders).
  let payment = null;
  if (order.provider === 'sumit' && order.provider_transaction_id && isSumitConfigured()) {
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

  // Everything that came back to the success webhook (GROW/Make), stored verbatim
  // in payment_events. We surface the latest non-SUMIT event's fields so the card
  // shows the full payment data (card suffix, brand, reference, payer, etc.).
  let paymentData: { provider: string; received_at: string; status: string; fields: Record<string, string> } | null = null;
  const { data: ev } = await supabase
    .from('payment_events')
    .select('provider, processing_status, created_at, raw_payload')
    .eq('order_id', order.id)
    .neq('provider', 'sumit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ev?.raw_payload && typeof ev.raw_payload === 'object') {
    const fields = flattenPrimitives(ev.raw_payload as Record<string, unknown>);
    // Never echo a shared secret back to the UI.
    for (const k of Object.keys(fields)) {
      if (/secret|token/i.test(k)) delete fields[k];
    }
    if (Object.keys(fields).length) {
      paymentData = {
        provider: ev.provider as string,
        received_at: ev.created_at as string,
        status: ev.processing_status as string,
        fields,
      };
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
      product_title: productTitle,
      products,
      provider_transaction_id: order.provider_transaction_id,
      document_id: order.document_id,
      has_invoice: Boolean(order.document_url || order.document_id),
      checkout_url: order.checkout_url,
    },
    customer: {
      name: (profile?.full_name as string | null) ?? null,
      email: userRes.data?.user?.email ?? null,
      phone: (profile?.phone as string | null) ?? null,
    },
    payment,
    paymentData,
  });
}

/** Flatten a payload to primitive key→string values (nested keys dotted). */
function flattenPrimitives(obj: Record<string, unknown>, prefix = '', out: Record<string, string> = {}, depth = 0): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') {
      if (depth < 3) flattenPrimitives(v as Record<string, unknown>, `${prefix}${k}.`, out, depth + 1);
    } else {
      out[`${prefix}${k}`] = String(v);
    }
  }
  return out;
}
