'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, X } from 'lucide-react';
import { GoogleGIcon } from '@/components/icons/google';
import OtpInput from '@/components/auth/OtpInput';
import { useContactForm, NameField, PhoneField } from '@/components/auth/ContactFields';
import {
  captureAttribution,
  stashPendingLead,
  type PendingLead,
} from '@/lib/learn/attribution';
import { lookupEmailProviders } from '@/lib/auth-providers';

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

const RESEND_COOLDOWN = 30; // seconds between code resends

/**
 * Branded fast-access modal. Two auth paths, no password:
 *   - Google Sign-In (primary)
 *   - Email code (name + email + phone + terms; optional marketing consent):
 *     we send a 6-digit code and verify it inline — the SAME method as the
 *     /login registration form (OtpInput + verifyOtp), not a magic-link email.
 *
 * The entered profile data + captured attribution are stashed in localStorage
 * so they survive and can be written to the profile once a session appears
 * (handled by AccessModalProvider after we navigate to returnTo).
 */
export default function AccessModal({ open, request, onClose }: Props) {
  const form = useContactForm();
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);

  // Code-verification step (mirrors LoginForm): set once a code has been sent.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpKey, setOtpKey] = useState(0); // bump to clear the OTP boxes
  const [resendIn, setResendIn] = useState(0);
  const [info, setInfo] = useState<string | null>(null);

  // Reset transient state each time the modal opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(null);
      setVerifyEmail(null);
      setOtp('');
      setInfo(null);
      setResendIn(0);
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

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!open || !request) return null;

  const buildPending = (): PendingLead => {
    const attr = captureAttribution();
    const pending: PendingLead = {
      ...attr,
      full_name: form.name.trim() || undefined,
      phone: form.phone.trim() || undefined,
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

  /** Send the 6-digit email code, then move to the inline verification step. */
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Name + phone are validated inline (red text under the field); email +
    // terms keep the single shared error line.
    const valid = form.validateAll();
    if (!valid) return;
    if (!email.trim()) return setError('יש להזין כתובת מייל');
    if (!terms) return setError('יש לאשר את תנאי השימוש ומדיניות הפרטיות');

    setLoading('email');

    // Cross-provider guard: if this email is registered with Google at all,
    // sending a code would bypass it — steer the user back to Google instead.
    const existing = await lookupEmailProviders(email.trim());
    if (existing.hasGoogle) {
      setLoading(null);
      setError('המייל הזה כבר רשום דרך Google. השתמש בכפתור "המשך עם Google" למעלה.');
      return;
    }

    // Stash everything now so it can be written to the profile once the session
    // exists (after we navigate to returnTo post-verification).
    stashPendingLead(buildPending());

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { full_name: valid.name } },
    });
    if (error) {
      setLoading(null);
      setError(translateError(error.message));
      return;
    }
    setLoading(null);
    setVerifyEmail(email.trim());
    setOtp('');
    setOtpKey((k) => k + 1);
    setResendIn(RESEND_COOLDOWN);
    setInfo('שלחנו לך קוד אימות בן 6 ספרות למייל.');
  }

  async function verifyCode(code: string) {
    if (!verifyEmail || loading === 'email') return;
    setError(null);
    setLoading('email');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: code,
      type: 'email',
    });
    if (error) {
      setLoading(null);
      setOtp('');
      setOtpKey((k) => k + 1); // clear boxes for another attempt
      setError(translateError(error.message));
      return;
    }
    // Session is set — go to where the user intended. AccessModalProvider on the
    // destination flushes the stashed name/phone/consent to the profile.
    window.location.assign(request!.returnTo);
  }

  async function resendCode() {
    if (!verifyEmail || resendIn > 0) return;
    setError(null);
    setInfo(null);
    setLoading('email');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: verifyEmail,
      options: { shouldCreateUser: true, data: { full_name: form.name.trim() } },
    });
    setLoading(null);
    if (error) {
      setError(translateError(error.message));
    } else {
      setInfo('שלחנו לך קוד חדש.');
      setResendIn(RESEND_COOLDOWN);
      setOtp('');
      setOtpKey((k) => k + 1);
    }
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

        {verifyEmail ? (
          /* ===== Code-verification step (same method as /login) ===== */
          <div className="space-y-5">
            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-extrabold text-neutral-950">הזן את קוד האימות</h2>
              <p className="text-sm text-neutral-700">
                שלחנו קוד בן 6 ספרות אל
                <br />
                <span className="font-semibold text-neutral-900" dir="ltr">
                  {verifyEmail}
                </span>
              </p>
            </div>

            <OtpInput
              key={otpKey}
              autoFocus
              disabled={loading === 'email'}
              onChange={setOtp}
              onComplete={verifyCode}
            />

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {info && !error && (
              <p className="text-sm text-brand-purple-900 bg-brand-purple-50 border border-brand-purple-200 rounded-md px-3 py-2 text-center">
                {info}
              </p>
            )}

            <button
              type="button"
              onClick={() => verifyCode(otp)}
              disabled={loading === 'email' || otp.length < 6}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 disabled:bg-neutral-300 text-white font-semibold transition-colors"
            >
              {loading === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
              אמת והמשך
            </button>

            <div className="text-center text-xs text-neutral-500 space-y-1.5">
              <div>
                לא קיבלת קוד?{' '}
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={resendIn > 0 || loading === 'email'}
                  className="font-semibold text-brand-purple-700 hover:text-brand-purple-600 disabled:text-neutral-400"
                >
                  {resendIn > 0 ? `שלח שוב בעוד ${resendIn}` : 'שלח קוד חדש'}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyEmail(null);
                    setError(null);
                    setInfo(null);
                    setOtp('');
                  }}
                  className="text-neutral-500 hover:text-brand-purple-700"
                >
                  ← חזרה
                </button>
              </div>
            </div>
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
              <span>או עם קוד למייל</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            {/* Email-code form */}
            <form onSubmit={sendCode} className="space-y-3" noValidate>
              <NameField
                id="am-name"
                value={form.name}
                error={form.nameError}
                onChange={form.onNameChange}
                onBlur={form.blurName}
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
              <PhoneField
                id="am-phone"
                label="טלפון"
                value={form.phone}
                error={form.phoneError}
                onChange={form.onPhoneChange}
                onBlur={form.blurPhone}
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
                שלח לי קוד אימות
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
    return 'התחברות דרך Google עוד לא הופעלה. השתמש בקוד למייל.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'נשלחו יותר מדי בקשות. נסה שוב בעוד דקה.';
  }
  if (m.includes('token has expired') || m.includes('expired')) return 'הקוד פג תוקף. בקש קוד חדש.';
  if (m.includes('invalid') && m.includes('token')) return 'הקוד שגוי. בדוק ונסה שוב.';
  if (m.includes('otp') || m.includes('invalid token')) return 'הקוד שגוי או פג תוקף. נסה שוב או בקש קוד חדש.';
  if (m.includes('invalid') && m.includes('email')) return 'כתובת מייל לא תקינה';
  return msg;
}
