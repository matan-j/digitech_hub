'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Copy, Check } from 'lucide-react';
import type { UserRow } from './page';

const STATUS_LABEL: Record<UserRow['subscription_status'], string> = {
  active: 'מנוי פעיל',
  cancelled: 'בוטל',
  past_due: 'בפיגור',
  none: 'אין מנוי',
};

const STATUS_CLS: Record<UserRow['subscription_status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  past_due: 'bg-amber-100 text-amber-800',
  none: 'bg-neutral-100 text-neutral-600',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso)); }
  catch { return iso; }
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = users.filter((u) => !search || u.email?.toLowerCase().includes(search.toLowerCase()));

  async function setRole(userId: string, role: 'admin' | 'subscriber') {
    setBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setBusyId(null);
    if (res.ok) startTransition(() => router.refresh());
    else alert('שגיאה');
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי מייל..."
          className="w-full max-w-sm px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ms-auto flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          הוסף משתמש
        </button>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-right px-4 py-3 font-semibold">מייל</th>
              <th className="text-right px-4 py-3 font-semibold">תפקיד</th>
              <th className="text-right px-4 py-3 font-semibold">מנוי</th>
              <th className="text-right px-4 py-3 font-semibold">חיוב הבא</th>
              <th className="text-right px-4 py-3 font-semibold">נרשם</th>
              <th className="text-right px-4 py-3 font-semibold">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900" dir="ltr">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      'inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold',
                      u.role === 'admin' ? 'bg-brand-purple-100 text-brand-purple-800' : 'bg-neutral-100 text-neutral-600',
                    ].join(' ')}
                  >
                    {u.role === 'admin' ? 'אדמין' : 'משתמש'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${STATUS_CLS[u.subscription_status]}`}>
                    {STATUS_LABEL[u.subscription_status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(u.current_period_end)}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => setRole(u.id, 'subscriber')}
                      disabled={busyId === u.id || pending}
                      className="text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                    >
                      הסר אדמין
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRole(u.id, 'admin')}
                      disabled={busyId === u.id || pending}
                      className="text-xs text-brand-purple-700 hover:text-brand-purple-800 font-semibold disabled:opacity-50"
                    >
                      קדם לאדמין
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">לא נמצאו משתמשים.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const symbols = '!@#$%&*';
  let p = '';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  p += symbols[arr[12] % symbols.length];
  p += String((arr[13] % 90) + 10); // 2-digit number
  return p;
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [role, setRole] = useState<'admin' | 'subscriber'>('subscriber');
  const [status, setStatus] = useState<UserRow['subscription_status']>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim() || undefined,
        role,
        subscription_status: status,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? 'create_failed');
      return;
    }
    setCreated(true);
  }

  async function copyCredentials() {
    const text = `מייל: ${email}\nסיסמה: ${password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-neutral-950">
            {created ? 'המשתמש נוצר' : 'הוסף משתמש חדש'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!created ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">שם מלא</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">מייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                placeholder="user@example.com"
                className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">סיסמה ראשונית</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="flex-1 px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="px-3 py-2 rounded-md border border-neutral-300 text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  צור
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">לפחות 8 תווים. המשתמש יוכל לשנות לאחר ההתחברות.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">תפקיד</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'subscriber')}
                  className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
                >
                  <option value="subscriber">משתמש</option>
                  <option value="admin">אדמין</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">סטטוס מנוי</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserRow['subscription_status'])}
                  className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
                >
                  <option value="active">פעיל</option>
                  <option value="none">ללא מנוי</option>
                  <option value="cancelled">בוטל</option>
                  <option value="past_due">בפיגור</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !email || password.length < 8}
                className="flex-1 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
              >
                {busy ? 'יוצר…' : 'צור משתמש'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50"
              >
                בטל
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-900 mb-2">העתק את הפרטים ושלח למשתמש:</p>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-neutral-500 text-xs">מייל:</span>{' '}
                  <span className="font-mono" dir="ltr">{email}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-xs">סיסמה:</span>{' '}
                  <span className="font-mono" dir="ltr">{password}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyCredentials}
                className="flex items-center gap-1.5 flex-1 px-4 py-2 rounded-pill border border-brand-purple-300 text-brand-purple-700 text-sm font-semibold hover:bg-brand-purple-50"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'הועתק' : 'העתק מייל + סיסמה'}
              </button>
              <button
                type="button"
                onClick={onCreated}
                className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold"
              >
                סגור
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
