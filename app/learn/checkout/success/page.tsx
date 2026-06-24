import Link from 'next/link';
import { Check, ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הגישה נפתחה — Digitech Hub' };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: slug } = await searchParams;
  await requireUser(slug ? `/learn/checkout/success?course=${slug}` : '/learn/courses');

  let title: string | null = null;
  let courseHref = '/learn/courses';
  if (slug) {
    const supabase = await createClient();
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
