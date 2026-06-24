'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { GoogleGIcon } from '@/components/icons/google';
import OtpInput from '@/components/auth/OtpInput';
import { NameField } from '@/components/auth/ContactFields';
import { validateHebrewFullName, normalizeFullName } from '@/lib/validation/profile';
import { lookupEmailProviders } from '@/lib/auth-providers';

type Mode = 'sign-in' | 'sign-up' | 'reset';

const RESEND_COOLDOWN = 30; // seconds between code resends

export default function LoginForm({ returnTo }: { returnTo?: string }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Code-verification step: set once a sign-up needs email confirmation.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpKey, setOtpKey] = useState(0); // bump to clear the OTP boxes
  const [resendIn, setResendIn] = useState(0);

  const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : '/learn';

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function enterVerifyStep(forEmail: string, message: string) {
    setVerifyEmail(forEmail);
    setOtp('');
    setOtpKey((k) => k + 1);
    setResendIn(RESEND_COOLDOWN);
    setError(null);
    setInfo(message);
    setLoading(null);
  }

  // Persist the sign-up consent (name + terms + marketing) once a session
  // exists — same profile fields the access-modal popup records. Best-effort;
  // only runs when the user actually accepted the terms (i.e. the sign-up path).
  async function recordConsent() {
    if (!terms) return;
    try {
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: normalizeFullName(fullName),
          marketing_consent: marketing,
          terms_accepted: true,
          intended_action: 'signup',
        }),
      });
    } catch {
      /* best-effort — never block the redirect */
    }
  }

  async function verifyCode(code: string) {
    if (!verifyEmail || loading === 'email') return;
    setError(null);
    setLoading('email');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: code,
      type: 'signup',
    });
    if (error) {
      setLoading(null);
      setOtp('');
      setOtpKey((k) => k + 1); // clear boxes for another attempt
      setError(translateError(error.message));
      return;
    }
    // verifyOtp set the session cookie — record consent, then go straight in.
    await recordConsent();
    window.location.href = safeReturnTo;
  }

  async function resendCode() {
    if (!verifyEmail || resendIn > 0) return;
    setError(null);
    setInfo(null);
    setLoading('email');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email: verifyEmail });
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

  async function continueWithGoogle() {
    setError(null);
    setInfo(null);
    setLoading('google');
    const supabase = createClient();
    const redirect = new URL('/auth/callback', window.location.origin);
    redirect.searchParams.set('next', safeReturnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect.toString() },
    });
    if (error) {
      setLoading(null);
      setError(translateError(error.message));
    }
    // On success the browser navigates to Google — no further action.
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading('email');
    const supabase = createClient();

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Unconfirmed account → send a fresh code and move to verification.
          if (error.message.toLowerCase().includes('email not confirmed')) {
            await supabase.auth.resend({ type: 'signup', email });
            enterVerifyStep(email, 'המייל שלך עוד לא אומת. שלחנו לך קוד אימות בן 6 ספרות.');
            return;
          }
          // Wrong password may actually mean "this email has no password — it's a
          // Google account". Steer there instead of the misleading credentials error.
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            const existing = await lookupEmailProviders(email);
            if (existing.hasGoogle && !existing.hasPassword) {
              setLoading(null);
              setError('המייל הזה מחובר דרך Google. השתמש בכפתור "התחברות עם Google" למעלה.');
              return;
            }
          }
          throw error;
        }
        window.location.href = safeReturnTo;
        return;
      }

      if (mode === 'sign-up') {
        const nameCheck = validateHebrewFullName(fullName);
        if (!nameCheck.valid) {
          setNameError(nameCheck.error ?? null);
          setLoading(null);
          return;
        }
        if (!terms) {
          setLoading(null);
          throw new Error('יש לאשר את תנאי השימוש ומדיניות הפרטיות');
        }
        if (password.length < 8) {
          throw new Error('הסיסמה חייבת להיות באורך 8 תווים לפחות');
        }
        // Cross-provider guard: never mint a second account for an email that
        // already exists under another method — steer the user to it instead.
        const existing = await lookupEmailProviders(email);
        if (existing.hasGoogle) {
          setLoading(null);
          setError('המייל הזה כבר רשום דרך Google. התחבר עם הכפתור "התחברות עם Google" למעלה.');
          return;
        }
        if (existing.hasPassword) {
          setLoading(null);
          setMode('sign-in');
          setInfo('כבר קיים חשבון עם המייל הזה. אפשר להתחבר עם הסיסמה, או לאפס סיסמה אם שכחת.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: normalizeFullName(fullName), marketing_consent: marketing },
          },
        });
        if (error) throw error;
        // If email confirmation is OFF, signUp returns a session — jump straight in.
        if (data.session) {
          await recordConsent();
          window.location.href = safeReturnTo;
          return;
        }
        enterVerifyStep(email, 'שלחנו לך קוד אימות בן 6 ספרות למייל.');
        return;
      }

      // reset mode
      const redirect = new URL('/auth/callback', window.location.origin);
      redirect.searchParams.set('next', '/learn/account');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirect.toString(),
      });
      if (error) throw error;
      setInfo('שלחנו קישור איפוס סיסמה. בדוק את המייל שלך.');
      setLoading(null);
    } catch (err) {
      setLoading(null);
      setError(err instanceof Error ? translateError(err.message) : 'אירעה שגיאה');
    }
  }

  // ===== Code-verification step =====
  if (verifyEmail) {
    return (
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <h2 className="text-lg font-extrabold text-neutral-950">הזן את קוד האימות</h2>
          <p className="text-sm text-neutral-700">
            שלחנו קוד בן 6 ספרות אל
            <br />
            <span className="font-semibold text-neutral-900" dir="ltr">{verifyEmail}</span>
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
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
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      {/* Google */}
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
        <span>התחברות עם Google</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="flex-1 h-px bg-neutral-200" />
        <span>או</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* Email / password */}
      <form onSubmit={handleEmail} className="space-y-3" noValidate>
        {mode === 'sign-up' && (
          <NameField
            id="signup-name"
            value={fullName}
            error={nameError}
            onChange={(v) => {
              setFullName(v);
              if (nameError) setNameError(null);
            }}
            onBlur={() => {
              const r = validateHebrewFullName(fullName);
              setNameError(r.valid ? null : r.error ?? null);
            }}
          />
        )}
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-semibold text-neutral-800">
            כתובת מייל
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 text-neutral-900 text-base"
          />
        </div>

        {mode !== 'reset' && (
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-semibold text-neutral-800">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              dir="ltr"
              minLength={mode === 'sign-up' ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'sign-up' ? 'לפחות 8 תווים' : '••••••••'}
              className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 text-neutral-900 text-base"
            />
          </div>
        )}

        {mode === 'sign-up' && (
          <>
            <label className="flex items-start gap-2.5 text-sm text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-purple-700"
              />
              <span>
                אני מאשר/ת את{' '}
                <a href="/terms" target="_blank" className="text-brand-purple-700 font-semibold underline">
                  תנאי השימוש
                </a>{' '}
                ו
                <a href="/privacy" target="_blank" className="text-brand-purple-700 font-semibold underline">
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
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && (
          <p className="text-sm text-brand-purple-900 bg-brand-purple-50 border border-brand-purple-200 rounded-md px-3 py-2">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading !== null || !email || (mode !== 'reset' && !password)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
        >
          {loading === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'sign-in' ? 'התחבר' : mode === 'sign-up' ? 'הרשם' : 'שלח קישור איפוס'}
        </button>
      </form>

      {/* Mode toggles */}
      <div className="text-center text-xs text-neutral-500 space-y-1.5">
        {mode === 'sign-in' && (
          <>
            <div>
              עדיין אין לך חשבון?{' '}
              <button
                type="button"
                onClick={() => { setMode('sign-up'); setError(null); setInfo(null); }}
                className="font-semibold text-brand-purple-700 hover:text-brand-purple-600"
              >
                הרשם כאן
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(null); setInfo(null); }}
                className="text-neutral-500 hover:text-brand-purple-700"
              >
                שכחתי סיסמה
              </button>
            </div>
          </>
        )}
        {mode === 'sign-up' && (
          <div>
            כבר יש לך חשבון?{' '}
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(null); setInfo(null); }}
              className="font-semibold text-brand-purple-700 hover:text-brand-purple-600"
            >
              התחבר כאן
            </button>
          </div>
        )}
        {mode === 'reset' && (
          <div>
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(null); setInfo(null); }}
              className="font-semibold text-brand-purple-700 hover:text-brand-purple-600"
            >
              ← חזרה להתחברות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'מייל או סיסמה שגויים';
  if (m.includes('email not confirmed')) return 'עוד לא אישרת את המייל שלך. בדוק את תיבת הדואר.';
  if (m.includes('token has expired') || m.includes('expired')) return 'הקוד פג תוקף. בקש קוד חדש.';
  if (m.includes('invalid') && m.includes('token')) return 'הקוד שגוי. בדוק ונסה שוב.';
  if (m.includes('otp') || m.includes('invalid token')) return 'הקוד שגוי או פג תוקף. נסה שוב או בקש קוד חדש.';
  if (m.includes('rate limit') || m.includes('too many')) return 'יותר מדי ניסיונות. המתן רגע ונסה שוב.';
  if (m.includes('user already registered')) return 'משתמש עם המייל הזה כבר קיים. התחבר במקום.';
  if (m.includes('weak password')) return 'הסיסמה חלשה מדי. בחר סיסמה ארוכה יותר.';
  if (m.includes('provider is not enabled') || m.includes('google')) {
    return 'התחברות דרך Google עוד לא הופעלה במערכת. השתמש במייל וסיסמה.';
  }
  return msg;
}
