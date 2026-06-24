'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MockCheckoutClient() {
  const params = useSearchParams();
  const router = useRouter();
  const order = params.get('order') ?? '';
  const [busy, setBusy] = useState(false);

  const send = async (outcome: 'paid' | 'failed') => {
    if (!order || busy) return;
    setBusy(true);
    await fetch('/api/webhooks/sumit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mock-signature': 'mock-sumit-token' },
      body: JSON.stringify({
        id: `mock-${order}-${outcome}`,
        type: outcome === 'paid' ? 'payment.succeeded' : 'payment.failed',
        status: outcome,
        publicOrderId: order,
        transactionId: `MOCK-TXN-${order}`,
      }),
    }).catch(() => {});
    router.push(outcome === 'paid' ? `/payment/success?order=${order}` : `/payment/failed?order=${order}`);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm text-center">
      <span className="inline-block px-2.5 py-1 rounded-pill bg-amber-100 text-amber-800 text-xs font-semibold mb-3">
        מצב בדיקה — SUMIT לא מחובר עדיין
      </span>
      <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">דף תשלום לדוגמה</h1>
      <p className="text-neutral-600 text-sm mb-1">הזמנה: <span className="font-mono">{order}</span></p>
      <p className="text-neutral-500 text-xs mb-6">
        זהו דף בדיקה מקומי שמדמה את מסך התשלום של SUMIT ושולח webhook אמיתי למערכת. אין חיוב.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => send('paid')}
          disabled={busy}
          className="px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 text-white font-semibold transition-colors disabled:opacity-50"
        >
          סמן כשולם (הצלחה)
        </button>
        <button
          onClick={() => send('failed')}
          disabled={busy}
          className="px-6 py-3 rounded-pill border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          סמן ככישלון
        </button>
      </div>
    </div>
  );
}
