'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { GoogleGIcon } from '@/components/icons/google';

type Mode = 'sign-in' | 'reset';

export default function AdminLoginForm({ returnTo }: { returnTo?: string }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const safeReturnTo =
    returnTo && returnTo.startsWith('/admin') ? returnTo : '/admin';

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
        if (error) throw error;
        window.location.href = safeReturnTo;
        return;
      }

      // reset password
      const redirect = new URL('/auth/callback', window.location.origin);
      redirect.searchParams.set('next', '/account');
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

  return (
    <div className="space-y-4">
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
        <span>המשך עם Google</span>
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="flex-1 h-px bg-neutral-200" />
        <span>או</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="admin-email" className="block text-sm font-semibold text-neutral-800">
            כתובת מייל
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@digi-tech.co.il"
            className="w-full px-3 py-2.5 rounded-md border border-brand-purple-200 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 text-neutral-900 text-base"
          />
        </div>

        {mode === 'sign-in' && (
          <div className="space-y-1">
            <label htmlFor="admin-password" className="block text-sm font-semibold text-neutral-800">
              סיסמה
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-md border border-brand-purple-200 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 text-neutral-900 text-base"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && (
          <p className="text-sm text-brand-purple-900 bg-brand-purple-50 border border-brand-purple-200 rounded-md px-3 py-2">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading !== null || !email || (mode === 'sign-in' && !password)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-900 hover:bg-brand-purple-700 disabled:bg-neutral-300 text-white font-semibold transition-colors"
        >
          {loading === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'sign-in' ? 'התחבר' : 'שלח קישור איפוס'}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-500">
        {mode === 'sign-in' ? (
          <button
            type="button"
            onClick={() => { setMode('reset'); setError(null); setInfo(null); }}
            className="text-neutral-500 hover:text-brand-purple-700"
          >
            שכחתי סיסמה
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('sign-in'); setError(null); setInfo(null); }}
            className="font-semibold text-brand-purple-700 hover:text-brand-purple-600"
          >
            ← חזרה להתחברות
          </button>
        )}
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'מייל או סיסמה שגויים';
  if (m.includes('email not confirmed')) return 'עוד לא אישרת את המייל שלך. בדוק את תיבת הדואר.';
  if (m.includes('provider is not enabled') || m.includes('google')) {
    return 'התחברות דרך Google עוד לא הופעלה במערכת. השתמש במייל וסיסמה.';
  }
  return msg;
}
