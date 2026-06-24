import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookSignature, parseWebhookEvent } from '@/lib/payments/sumit';
import {
  getOrderByPublicId,
  markOrderPaid,
  markOrderFailed,
  validatePaymentAgainstOrder,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';

export const runtime = 'nodejs';

/**
 * SUMIT webhook. The ONLY place access is granted.
 * Flow: verify signature -> log event (idempotent) -> match order -> validate
 * amount/currency/txn -> mark paid -> grant entitlement.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get('x-sumit-signature') ?? request.headers.get('x-mock-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const event = parseWebhookEvent(payload);
  const supabase = createServiceClient();

  // Idempotent event log — unique (provider, provider_event_id).
  const { error: logError } = await supabase.from('payment_events').insert({
    provider: 'sumit',
    provider_event_id: event.providerEventId,
    event_type: event.eventType,
    raw_payload: payload,
    processing_status: 'received',
  });
  if (logError) {
    // Duplicate event id -> already processed. Ack so the provider stops retrying.
    if (logError.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: 'log_failed', message: logError.message }, { status: 500 });
  }

  const finish = async (status: 'processed' | 'ignored' | 'error', orderId: string | null, errMsg?: string) => {
    await supabase
      .from('payment_events')
      .update({
        order_id: orderId,
        processing_status: status,
        processing_error: errMsg ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'sumit')
      .eq('provider_event_id', event.providerEventId);
  };

  if (!event.publicOrderId) {
    await finish('ignored', null, 'no public order id');
    return NextResponse.json({ ok: true, ignored: true });
  }

  const order = await getOrderByPublicId(event.publicOrderId);
  if (!order) {
    await finish('error', null, 'order not found');
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (event.status === 'failed') {
    await markOrderFailed(order.id);
    await finish('processed', order.id);
    return NextResponse.json({ ok: true, status: 'failed' });
  }

  if (event.status !== 'paid') {
    await finish('ignored', order.id, `unhandled status ${event.status}`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Validate the payment matches the order before granting anything.
  const invalid = validatePaymentAgainstOrder(order, event);
  if (invalid) {
    await finish('error', order.id, invalid);
    return NextResponse.json({ error: 'validation_failed', message: invalid }, { status: 400 });
  }

  await markOrderPaid(order.id, event.providerTransactionId);
  await grantEntitlement({
    userId: order.user_id,
    resourceType: order.content_type,
    resourceId: order.content_id,
    orderId: order.id,
    source: 'purchase',
  });

  await finish('processed', order.id);
  return NextResponse.json({ ok: true, status: 'paid' });
}
