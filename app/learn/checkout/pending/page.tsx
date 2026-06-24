import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'בקשת הרכישה התקבלה — Digitech Hub' };

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' };

export default async function CheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: publicOrderId } = await searchParams;
  await requireUser(publicOrderId ? `/learn/checkout/pending?order=${publicOrderId}` : '/learn/courses');

  // Owner-only read (orders RLS = own-or-admin). We deliberately show only the
  // requested product + price — NEVER that access was granted or payment made.
  let productTitle: string | null = null;
  let amount: number | null = null;
  let originalAmount: number | null = null;
  let currency = 'ILS';
  if (publicOrderId) {
    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('content_id, amount, original_amount, currency')
      .eq('public_order_id', publicOrderId)
      .maybeSingle();
    if (order) {
      amount = Number(order.amount);
      originalAmount = order.original_amount != null ? Number(order.original_amount) : null;
      currency = (order.currency as string) ?? 'ILS';
      const { data: item } = await supabase
        .from('content_items')
        .select('title')
        .eq('id', order.content_id)
        .maybeSingle();
      productTitle = (item?.title as string) ?? null;
    }
  }

  const sym = CURRENCY_SYMBOL[currency] ?? '₪';

  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: 'var(--color-bg-main)' }} dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="w-8 h-8 text-amber-600" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">בקשת הרכישה התקבלה</h1>
        <p className="text-neutral-600 text-sm mb-5">
          קיבלנו את הבקשה שלך. קישור התשלום יטופל בהמשך ויישלח אליך בנפרד. הגישה לתוכן תיפתח רק לאחר אישור תשלום.
        </p>

        {productTitle && (
          <div className="rounded-xl border border-neutral-100 bg-brand-purple-50/40 px-4 py-3 mb-6 text-start">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-purple-700 mb-1">המוצר המבוקש</p>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-neutral-900">{productTitle}</p>
              {amount != null && (
                <p className="font-extrabold text-brand-purple-800 tabular-nums whitespace-nowrap">
                  {sym}{amount}
                  {originalAmount != null && originalAmount > amount && (
                    <span className="ms-1.5 text-xs font-medium text-neutral-400 line-through">{sym}{originalAmount}</span>
                  )}
                </p>
              )}
            </div>
            {publicOrderId && <p className="text-[11px] text-neutral-400 mt-2" dir="ltr">#{publicOrderId}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link href="/learn/courses" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold transition-colors">
            המשך לעיון בקורסים
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link href="/account" className="inline-block px-6 py-3 rounded-pill border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors">
            לאזור האישי
          </Link>
        </div>
      </div>
    </main>
  );
}
