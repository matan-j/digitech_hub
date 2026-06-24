// ============================================================
// GET /api/account/orders/[id]/invoice
// Redirect to the SUMIT receipt/invoice PDF for an order. `[id]` is the
// public_order_id (e.g. DGH-XXXX). Authorized for the order's OWNER or any ADMIN.
// Falls back to a live SUMIT lookup when the URL wasn't captured at settle time.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOrderByPublicId, setOrderInvoice } from '@/lib/payments/order-service';
import { sumitGetDocumentDownloadUrl } from '@/lib/payments/sumit';

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

  // Prefer the URL captured at settle; otherwise resolve a fresh one and cache it.
  let url = order.document_url;
  if (!url && order.document_id) {
    url = await sumitGetDocumentDownloadUrl(order.document_id);
    if (url) await setOrderInvoice(order.id, { documentUrl: url });
  }
  if (!url) return NextResponse.json({ error: 'invoice_unavailable' }, { status: 404 });

  return NextResponse.redirect(url);
}
