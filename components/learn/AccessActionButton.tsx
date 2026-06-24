'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAccessGate } from '@/components/auth/AccessModalProvider';
import type { ContentType } from '@/lib/payments/order-service';

/**
 * High-intent CTA that ties a content page to the access-gate + enrollment +
 * payment APIs (Phase 1B wiring).
 *
 *  enroll    — free course: register (if anon) → POST /api/enrollments → open lesson.
 *  purchase  — paid item: register (if anon) → POST /api/purchase → pending page
 *              (final price 0 grants immediately + success page). No payment link.
 *  subscribe — legacy all-access: register (if anon) → /upgrade.
 *  login     — login_required body: register (if anon) → reveal content on return.
 *  continue  — viewer already has access: plain navigation, no gate.
 *
 * For anonymous viewers requireAccess() opens the AccessModal and stashes the
 * intent; the action runs for authenticated viewers immediately.
 */
export type AccessActionKind = 'enroll' | 'purchase' | 'subscribe' | 'login' | 'continue';

export default function AccessActionButton({
  kind,
  slug,
  contentType,
  returnTo,
  targetHref,
  label,
  className,
  errorClassName = 'text-xs text-red-600 mt-1',
  icon,
}: {
  kind: AccessActionKind;
  slug: string;
  /** Required for kind='purchase'. */
  contentType?: ContentType;
  returnTo: string;
  /** Lesson/content href for kind='enroll'|'continue'. */
  targetHref?: string | null;
  label: string;
  className?: string;
  errorClassName?: string;
  icon?: React.ReactNode;
}) {
  const { requireAccess } = useAccessGate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Shown when a logged-in buyer has no phone on file — collected before the
  // purchase webhook can be sent.
  const [phoneNeeded, setPhoneNeeded] = useState(false);
  const [phone, setPhone] = useState('');

  // Already-accessible content → a plain link, no gate, no JS round-trip.
  if (kind === 'continue' && targetHref) {
    return (
      <Link href={targetHref} className={className}>
        {icon}
        {label}
      </Link>
    );
  }

  async function enrollThenGo() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(res.status === 402 ? 'קורס זה דורש רכישה.' : d?.message ?? 'שגיאה, נסו שוב.');
        setBusy(false);
        return;
      }
      if (targetHref) router.push(targetHref);
      else router.refresh();
    } catch {
      setErr('שגיאת רשת.');
      setBusy(false);
    }
  }

  async function startPurchase(phoneArg?: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: contentType ?? 'course', slug, phone: phoneArg }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d?.redirect === 'string') {
        // free → branded success page; paid → branded pending page.
        router.push(d.redirect);
        return;
      }
      if (res.status === 400 && d?.error === 'phone_required') {
        setPhoneNeeded(true);
        setBusy(false);
        return;
      }
      if (res.status === 502 && d?.error === 'webhook_failed') {
        setErr('שליחת הבקשה נכשלה. נסו שוב.');
        setBusy(false);
        return;
      }
      setErr('שגיאה בביצוע הרכישה. נסו שוב.');
      setBusy(false);
    } catch {
      setErr('שגיאת רשת.');
      setBusy(false);
    }
  }

  function submitPhone() {
    const trimmed = phone.trim();
    if (!trimmed) { setErr('נא להזין מספר טלפון.'); return; }
    setPhoneNeeded(false);
    void startPurchase(trimmed);
  }

  function onClick() {
    const action =
      kind === 'enroll'
        ? 'enroll_course'
        : kind === 'purchase'
          ? `purchase_${contentType ?? 'content'}`
          : kind === 'subscribe'
            ? 'subscribe'
            : 'unlock_content';
    const run =
      kind === 'enroll'
        ? enrollThenGo
        : kind === 'purchase'
          ? () => startPurchase()
          : kind === 'subscribe'
            ? () => window.location.assign(`/upgrade?return=${encodeURIComponent(returnTo)}`)
            : () => router.refresh(); // 'login' — authed path reveals the body
    requireAccess({ action, returnTo, run });
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" onClick={onClick} disabled={busy} className={className}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {label}
      </button>
      {phoneNeeded && (
        <span className="mt-2 flex items-center gap-2">
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitPhone(); } }}
            placeholder="מספר טלפון"
            className="px-3 py-2 rounded-pill border border-neutral-300 text-sm text-neutral-900 bg-white focus:outline-none focus:border-brand-purple-400 w-44"
          />
          <button
            type="button"
            onClick={submitPhone}
            disabled={busy}
            className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold disabled:opacity-70"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'המשך'}
          </button>
        </span>
      )}
      {phoneNeeded && <span className="mt-1 text-[11px] text-brand-purple-100">צריך מספר טלפון כדי להשלים את בקשת הרכישה.</span>}
      {err && <span className={errorClassName}>{err}</span>}
    </span>
  );
}
