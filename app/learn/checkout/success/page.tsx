import Link from 'next/link';
import { Check, ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הגישה נפתחה — Digitech Hub' };

/**
 * Thank-you page. Accepts either:
 *   ?order=<public_order_id>  (preferred — GROW/Make return URL) → resolves the
 *                             course from the order and shows the order number.
 *   ?course=<slug>            (legacy) → resolves by slug.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; order?: string }>;
}) {
  const { course: courseParam, order: publicOrderId } = await searchParams;
  const here = publicOrderId
    ? `/learn/checkout/success?order=${publicOrderId}`
    : courseParam
      ? `/learn/checkout/success?course=${courseParam}`
      : '/learn/courses';
  await requireUser(here);

  const supabase = await createClient();

  // Resolve the course slug — from the order (owner-only via RLS) or the param.
  // Also pull the coupon snapshot to confirm it on the receipt.
  let slug = courseParam ?? null;
  let couponCode: string | null = null;
  let couponDiscount: number | null = null;
  let currency = 'ILS';
  if (publicOrderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('content_id, coupon_code, coupon_discount, currency')
      .eq('public_order_id', publicOrderId)
      .maybeSingle();
    couponCode = (order?.coupon_code as string | null) ?? null;
    couponDiscount = order?.coupon_discount != null ? Number(order.coupon_discount) : null;
    currency = (order?.currency as string | null) ?? 'ILS';
    if (!slug && order?.content_id) {
      const { data: item } = await supabase
        .from('content_items')
        .select('slug')
        .eq('id', order.content_id)
        .maybeSingle();
      slug = (item?.slug as string) ?? null;
    }
  }

  let title: string | null = null;
  let courseHref = '/learn/courses';
  if (slug) {
    const { data } = await supabase
      .from('content_items')
      .select('title, slug')
      .eq('slug', slug)
      .maybeSingle();
    if (data) {
      title = data.title as string;
      courseHref = `/learn/courses/${data.slug}`;
    }
  }

  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: 'var(--color-bg-main)' }} dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">הגישה נפתחה! 🎉</h1>
        <p className="text-neutral-600 text-sm mb-5">
          קיבלת גישה מלאה — אפשר להתחיל ללמוד עכשיו.
        </p>

        <div className="rounded-xl border border-neutral-100 bg-brand-purple-50/40 px-4 py-3 mb-6 text-start">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-purple-700 mb-1">קיבלת</p>
          <p className="font-bold text-neutral-900">{title ?? 'הקורס שלך'}</p>
          <p className="text-xs text-emerald-700 mt-1">הגישה פעילה ✓</p>
          {couponCode && (
            <div className="mt-3 pt-3 border-t border-brand-purple-100/70 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">שולם עם קופון</span>
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-brand-purple-700" dir="ltr">{couponCode}</span>
                {couponDiscount != null && couponDiscount > 0 && (
                  <span className="text-xs font-semibold text-emerald-700">
                    חסכת {currency === 'ILS' ? `₪${couponDiscount.toLocaleString('he-IL')}` : `${couponDiscount} ${currency}`}
                  </span>
                )}
              </span>
            </div>
          )}
          {publicOrderId && (
            <div className="mt-3 pt-3 border-t border-brand-purple-100/70 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">מספר הזמנה</span>
              <span className="font-mono text-sm font-bold text-neutral-800" dir="ltr">{publicOrderId}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {slug && (
            <Link href={courseHref} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold transition-colors">
              התחל ללמוד
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <Link href="/learn/courses" className="inline-block px-6 py-3 rounded-pill border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors">
            לכל הקורסים
          </Link>
        </div>
      </div>
    </main>
  );
}
