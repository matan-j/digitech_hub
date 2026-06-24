import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export const metadata = { title: 'אישור תשלום — Digitech Hub' };

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: 'var(--color-bg-main)' }} dir="rtl">
      <Suspense fallback={null}>
        <SuccessClient />
      </Suspense>
    </main>
  );
}
