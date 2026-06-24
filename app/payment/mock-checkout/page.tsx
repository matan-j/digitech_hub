import { Suspense } from 'react';
import MockCheckoutClient from './MockCheckoutClient';

export const metadata = { title: 'תשלום (מצב בדיקה) — Digitech Hub' };

// MOCK SUMIT hosted checkout. Active only while live SUMIT credentials are not
// configured (lib/payments/sumit#isSumitLive === false). Lets the full
// order -> webhook -> entitlement flow be tested without a real charge.
export default function MockCheckoutPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: 'var(--color-bg-main)' }} dir="rtl">
      <Suspense fallback={null}>
        <MockCheckoutClient />
      </Suspense>
    </main>
  );
}
