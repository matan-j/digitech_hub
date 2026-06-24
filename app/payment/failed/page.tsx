import Link from 'next/link';

export const metadata = { title: 'התשלום לא הושלם — Digitech Hub' };

export default function PaymentFailedPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: 'var(--color-bg-main)' }} dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">התשלום לא הושלם</h1>
        <p className="text-neutral-600 text-sm mb-6">
          לא בוצע חיוב. אפשר לנסות שוב, או לחזור לעיון בתוכן. אם הבעיה חוזרת — נשמח לעזור.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/learn/courses" className="inline-block px-6 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 text-white font-semibold transition-colors">
            חזרה לקורסים
          </Link>
          <Link href="/learn" className="inline-block px-6 py-3 rounded-pill border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors">
            ל-Hub
          </Link>
        </div>
      </div>
    </main>
  );
}
