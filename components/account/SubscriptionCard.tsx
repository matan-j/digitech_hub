'use client';

import { useState } from 'react';
import type { Profile } from '@/lib/auth';

const STATUS_LABELS: Record<Profile['subscription_status'], string> = {
  active: 'פעיל',
  cancelled: 'בוטל',
  past_due: 'בפיגור תשלום',
  none: 'אין מנוי',
};

const STATUS_COLORS: Record<Profile['subscription_status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  past_due: 'bg-amber-100 text-amber-800',
  none: 'bg-neutral-100 text-neutral-600',
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function SubscriptionCard({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null);

  async function startCheckout() {
    setLoading('checkout');
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(null);
      alert(data.error ?? 'שגיאה ביצירת תשלום');
    }
  }

  async function openPortal() {
    setLoading('portal');
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(null);
      alert(data.error ?? 'שגיאה בפתיחת פורטל הלקוח');
    }
  }

  const isActive = profile.subscription_status === 'active';
  const isAdmin = profile.role === 'admin';
  const periodEnd = formatDate(profile.current_period_end);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-950">מועדון Digitech</h2>
          <p className="text-sm text-neutral-500 mt-0.5">סטטוס מנוי</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-pill ${STATUS_COLORS[profile.subscription_status]}`}>
          {isAdmin ? 'אדמין · גישה מלאה' : STATUS_LABELS[profile.subscription_status]}
        </span>
      </div>

      {isAdmin && (
        <p className="text-sm text-neutral-600 mb-4">
          כאדמין יש לך גישה מלאה לכל התוכן ללא תשלום.
        </p>
      )}

      {!isAdmin && isActive && (
        <>
          {periodEnd && (
            <p className="text-sm text-neutral-600 mb-4">
              חיוב הבא: <span className="font-semibold text-neutral-800">{periodEnd}</span>
            </p>
          )}
          <button
            onClick={openPortal}
            disabled={loading !== null}
            className="px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-800 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'portal' ? 'פותח...' : 'נהל מנוי / חיוב'}
          </button>
        </>
      )}

      {!isAdmin && profile.subscription_status === 'cancelled' && periodEnd && (
        <>
          <p className="text-sm text-neutral-600 mb-4">
            המנוי בוטל. גישה נותרת עד <span className="font-semibold">{periodEnd}</span>.
          </p>
          <button
            onClick={openPortal}
            disabled={loading !== null}
            className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'portal' ? 'פותח...' : 'חדש מנוי'}
          </button>
        </>
      )}

      {!isAdmin && (profile.subscription_status === 'none' || profile.subscription_status === 'past_due') && (
        <>
          <p className="text-sm text-neutral-600 mb-4">
            הירשם למועדון כדי לקבל גישה מלאה לקורסים, הדרכות ופלייבוקים.
          </p>
          <button
            onClick={startCheckout}
            disabled={loading !== null}
            className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading === 'checkout' ? 'מעביר לתשלום...' : 'הירשם למועדון'}
          </button>
        </>
      )}
    </div>
  );
}
