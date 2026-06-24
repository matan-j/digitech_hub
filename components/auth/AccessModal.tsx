'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, X } from 'lucide-react';
import { GoogleGIcon } from '@/components/icons/google';
import {
  captureAttribution,
  stashPendingLead,
  type PendingLead,
} from '@/lib/learn/attribution';

export type AccessRequest = {
  /** Machine label of the gated action, e.g. 'watch_full_guide'. */
  action: string;
  /** Local path to return to after auth completes. */
  returnTo: string;
  /** Optional touchpoint slug to record (guide/creator/course). */
  touchpoint?: string;
};

type Props = {
  open: boolean;
  request: AccessRequest | null;
  onClose: () => void;
};

/**
 * Branded fast-access modal. Two auth paths, no password:
 *   - Google Sign-In (primary)
 *   - Magic Link (name + email + phone + terms; optional marketing consent)
 *
 * On either path the entered profile data + captured attribution are stashed
 * in localStorage so they survive the auth redirect and can be written to the
 * profile once a session appears (handled by AccessModalProvider).
 */
export default function AccessModal({ open, request, onClose }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Reset transient state each time the modal opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(null);
      setSent(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !request) return null;

  const buildPending = (): PendingLead => {
    const attr = captureAttribution();
    const pending: PendingLead = {
      ...attr,
      full_name: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      marketing_consent: marketing,
      intended_action: request.action,
      return_to: request.returnTo,
    };
    if (request.touchpoint) {
      // Record the explicit touchpoint if the path-derived one is missing.
      if (!pending.first_guide_touchpoint && request.action.includes('guide')) {
        pending.first_guide_touchpoint = request.touchpoint;
      }
      if (!pending.first_course_touchpoint && request.action.includes('course')) {
        pending.first_course_touchpoint = request.touchpoint;
      }
      if (
        !pending.first_creator_touchpoint &&
        request.action.includes('creator')
      ) {
        pending.first_creator_touchpoint = request.touchpoint;
      }
    }
    return pending;
  };

  function callbackUrl(): string {
    const url = new URL('/auth/callback', window.location.origin);
    url.searchParams.set('next', request!.returnTo);
    return url.toString();
  }

  async function continueWithGoogle() {
    setError(null);
    setLoading('google');
    // Stash attribution + intent now; name/phone/terms are collected post-auth.
    stashPendingLead(buildPending());
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setLoading(null);
      setError(translateError(error.message));
    }
    // On success the browser navigates to Google.
  }

  async function continueWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) return setError('יש להזין שם מלא');
    if (!email.trim()) return setError('יש להזין כתובת מייל');
    if (!phone.trim()) return setError('יש להזין מספר טלפון');
    if (!terms) return setError('יש לאשר את תנאי השימוש ומדיניות הפרטיות');

    setLoading('email');
    // Stash everything (incl. terms acceptance via marketing/consent context)
    // so we can write it once the session exists after the redirect.
    const pending = buildPending();
    stashPendingLead(pending);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl(),
        shouldCreateUser: true,
        data: { full_name: fullName.trim() },
      },
    });
    if (error) {
      setLoading(null);
      setError(translateError(error.message));
      return;
    }
    setLoading(null);
    setSent(true);
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="סגור"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/50"
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 left-4 w-8 h-8 rounded-pill flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {sent ? (
          <div className="text-center py-4">
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-pill flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'var(--color-brand-purple-50)' }}
            >
              ✉️
            </div>
            <h2 className="text-xl font-extrabold text-neutral-950 mb-2">
              בדוק את המייל שלך
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed">
              שלחנו קישור התחברות ל-
              <span dir="ltr" className="font-semibold">
                {email}
              </span>
              . לחץ עליו כדי להמשיך — תחזור בדיוק לאן שהיית.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold text-brand-purple-700 mb-1.5">
              עוד צעד קטן
            </h2>
            <p className="text-sm text-neutral-700 mb-5 leading-relaxed">
              צור חשבון חינמי כדי להמשיך — הגישה לתוכן, השמירה וההתקדמות נשמרים
              איתך. שנייה ואתה בפנים.
            </p>

            {/* Google — primary */}
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-pill border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 text-neutral-800 font-semibold transition-colors"
            >
              {loading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleGIcon className="w-4 h-4" />
              )}
              <span>המשך עם Google</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-neutral-400 my-4">
              <div className="flex-1 h-px bg-neutral-200" />
              <span>או עם קישור למייל</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            {/* Magic link form */}
            <form onSubmit={continueWithMagicLink} className="space-y-3">
              <Field
                id="am-name"
                label="שם מלא"
                value={fullName}
                onChange={setFullName}
                placeholder="ישראל ישראלי"
                autoComplete="name"
              />
              <Field
                id="am-email"
                label="כתובת מייל"
                type="email"
                dir="ltr"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                id="am-phone"
                label="טלפון"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={setPhone}
                placeholder="050-0000000"
                autoComplete="tel"
              />

              <label className="flex items-start gap-2.5 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand-purple-700"
                />
                <span>
                  אני מאשר/ת את{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    className="text-brand-purple-700 font-semibold underline"
                  >
                    תנאי השימוש
                  </a>{' '}
                  ו
                  <a
                    href="/privacy"
                    target="_blank"
                    className="text-brand-purple-700 font-semibold underline"
                  >
                    מדיניות הפרטיות
                  </a>
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand-purple-700"
                />
                <span>אשמח לקבל עדכונים ותכנים שיווקיים במייל (לא חובה)</span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 disabled:bg-neutral-300 text-white font-semibold transition-colors"
              >
                {loading === 'email' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                שלח לי קישור כניסה
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  dir,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  dir?: 'ltr' | 'rtl';
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 text-neutral-900 text-base"
      />
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('google')) {
    return 'התחברות דרך Google עוד לא הופעלה. השתמש בקישור למייל.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'נשלחו יותר מדי בקשות. נסה שוב בעוד דקה.';
  }
  if (m.includes('invalid') && m.includes('email')) return 'כתובת מייל לא תקינה';
  return msg;
}
