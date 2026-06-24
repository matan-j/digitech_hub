'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Phase = 'verifying' | 'paid' | 'timeout';

// Polls internal order/entitlement state. Access is NEVER inferred from the URL —
// we only show success once the verified webhook has marked the order paid.
export default function SuccessClient() {
  const params = useSearchParams();
  const order = params.get('order');
  const [phase, setPhase] = useState<Phase>('verifying');

  useEffect(() => {
    if (!order) {
      setPhase('timeout');
      return;
    }
    let attempts = 0;
    let active = true;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/payments/status?order=${encodeURIComponent(order)}`);
        const data = await res.json();
        if (active && data.status === 'paid' && data.entitled) {
          setPhase('paid');
          return;
        }
      } catch {
        /* keep polling */
      }
      if (active) {
        if (attempts >= 20) setPhase('timeout'); // ~60s
        else setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      active = false;
    };
  }, [order]);

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm text-center">
      {phase === 'verifying' && (
        <>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-brand-purple-200 border-t-brand-purple-700 animate-spin" />
          <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">מאמתים את התשלום ופותחים את הגישה שלך</h1>
          <p className="text-neutral-600 text-sm">רגע אחד — אנחנו מוודאים את התשלום מול ספק הסליקה.</p>
        </>
      )}
      {phase === 'paid' && (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">התשלום אושר — הגישה נפתחה!</h1>
          <p className="text-neutral-600 text-sm mb-6">הקורס זמין עכשיו באזור הלמידה שלך.</p>
          <Link href="/learn/my-learning" className="inline-block px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 text-white font-semibold transition-colors">
            לאזור הלמידה שלי
          </Link>
        </>
      )}
      {phase === 'timeout' && (
        <>
          <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">התשלום בעיבוד</h1>
          <p className="text-neutral-600 text-sm mb-6">
            האימות לוקח מעט יותר זמן מהרגיל. הגישה תיפתח אוטומטית ברגע שהתשלום יאומת — אפשר לרענן את האזור האישי בעוד דקה.
          </p>
          <Link href="/learn/my-learning" className="inline-block px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 text-white font-semibold transition-colors">
            לאזור הלמידה שלי
          </Link>
        </>
      )}
    </div>
  );
}
