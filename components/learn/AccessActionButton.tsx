'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAccessGate } from '@/components/auth/AccessModalProvider';
import { useContactInfo } from '@/components/auth/ContactInfoProvider';
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
  const { requireContactInfo } = useContactInfo();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  // Ensure a valid name + phone are on file (popup if not), then purchase. The
  // /api/purchase route reads name + phone from the saved profile.
  async function runPurchase() {
    const info = await requireContactInfo();
    if (!info) return; // user dismissed the popup — abort silently
    await startPurchase();
  }

  async function startPurchase() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: contentType ?? 'course', slug }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d?.redirect === 'string') {
        // free → branded success page; paid → branded pending page.
        router.push(d.redirect);
        return;
      }
      if (res.status === 400 && d?.error === 'phone_required') {
        // Should be covered by the gate above; re-prompt as a safety net.
        setBusy(false);
        const info = await requireContactInfo();
        if (info) { await startPurchase(); return; }
        setErr('צריך מספר טלפון כדי להשלים את בקשת הרכישה.');
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
          ? runPurchase
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
      {err && <span className={errorClassName}>{err}</span>}
    </span>
  );
}
