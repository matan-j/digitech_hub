'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Copy, Check, Loader2, GraduationCap, ChevronLeft } from 'lucide-react';
import type { UserRow } from './page';
import PurchasesTable, { type PurchaseRow } from '@/components/account/PurchasesTable';

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

const ROLE_LABEL: Record<UserRow['role'], string> = {
  admin: 'אדמין',
  creator: 'יוצר',
  subscriber: 'משתמש',
};

const ROLE_CLS: Record<UserRow['role'], string> = {
  admin: 'bg-brand-purple-100 text-brand-purple-800',
  creator: 'bg-indigo-100 text-indigo-800',
  subscriber: 'bg-neutral-100 text-neutral-600',
};

const SOURCE_LABEL: Record<string, string> = {
  free: 'הרשמה חינמית',
  purchase: 'רכישה',
  admin: 'הענקת מנהל',
  migration: 'מיגרציה',
  gift: 'מתנה',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso)); }
  catch { return iso; }
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = users.filter((u) => !search || u.email?.toLowerCase().includes(search.toLowerCase()));
  const detailUser = detailId ? users.find((u) => u.id === detailId) ?? null : null;

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
            router.refresh();
          }}
        />
      )}

      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailId(null)}
          onRoleChanged={() => router.refresh()}
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
              <th className="text-right px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => setDetailId(u.id)}
                className="border-t border-neutral-100 hover:bg-brand-purple-50/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-neutral-900" dir="ltr">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${ROLE_CLS[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${STATUS_CLS[u.subscription_status]}`}>
                    {STATUS_LABEL[u.subscription_status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(u.current_period_end)}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-end">
                  <span className="inline-flex items-center gap-1 text-xs text-brand-purple-700 font-semibold">
                    פרטים
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
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

type Grant = {
  kind: 'entitlement' | 'enrollment';
  resource_type: string;
  resource_id: string;
  title: string;
  source: string;
  granted_at: string;
};
type Course = { id: string; slug: string; title: string; type: string };
type AccessData = { courses: Course[]; grants: Grant[]; purchases: PurchaseRow[] };

function UserDetailModal({
  user,
  onClose,
  onRoleChanged,
}: {
  user: UserRow;
  onClose: () => void;
  onRoleChanged: () => void;
}) {
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignId, setAssignId] = useState('');
  const [roleBusy, setRoleBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/admin/users/${user.id}/access`);
      if (!alive) return;
      if (res.ok) setData(await res.json());
      else setError('שגיאה בטעינת הגישות.');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user.id]);

  // Optimistic: show/remove the tag instantly, sync in the background, roll back on error.
  async function assign(resourceId: string) {
    if (!resourceId || !data) return;
    const course = data.courses.find((c) => c.id === resourceId);
    if (!course) return;
    setError(null);
    setAssignId('');
    const optimistic: Grant = {
      kind: 'entitlement',
      resource_type: 'course',
      resource_id: resourceId,
      title: course.title,
      source: 'admin',
      granted_at: new Date().toISOString(),
    };
    setData((d) => (d ? { ...d, grants: [...d.grants, optimistic] } : d));
    const res = await fetch('/api/admin/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, resourceType: 'course', resourceId }),
    });
    if (!res.ok) {
      setData((d) => (d ? { ...d, grants: d.grants.filter((g) => g.resource_id !== resourceId) } : d));
      setError('שגיאה בשיוך הקורס.');
    }
  }

  async function unassign(g: Grant) {
    if (!data) return;
    setError(null);
    setData((d) => (d ? { ...d, grants: d.grants.filter((x) => !(x.resource_id === g.resource_id && x.kind === g.kind)) } : d));
    const res = await fetch('/api/admin/access', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: g.kind, userId: user.id, resourceType: g.resource_type, resourceId: g.resource_id }),
    });
    if (!res.ok) {
      setData((d) => (d ? { ...d, grants: [...d.grants, g] } : d));
      setError('שגיאה בהסרת השיוך.');
    }
  }

  async function setRole(role: UserRow['role']) {
    setRoleBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setRoleBusy(false);
    if (res.ok) startTransition(() => onRoleChanged());
    else setError('שגיאה בעדכון התפקיד.');
  }

  const assignedIds = new Set((data?.grants ?? []).map((g) => g.resource_id));
  const available = (data?.courses ?? []).filter((c) => !assignedIds.has(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        dir="rtl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-950" dir="ltr">{user.email ?? '—'}</h2>
            <span className={`mt-1.5 inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${ROLE_CLS[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User details */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">סטטוס מנוי</dt>
            <dd className="mt-0.5">
              <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${STATUS_CLS[user.subscription_status]}`}>
                {STATUS_LABEL[user.subscription_status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">חיוב הבא</dt>
            <dd className="mt-0.5 text-neutral-800">{formatDate(user.current_period_end)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">נרשם</dt>
            <dd className="mt-0.5 text-neutral-800">{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">מזהה</dt>
            <dd className="mt-0.5 text-neutral-400 text-[11px] font-mono truncate" dir="ltr">{user.id}</dd>
          </div>
        </dl>

        {/* Role management */}
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-neutral-700 uppercase tracking-wide mb-2">תפקיד</h3>
          <div className="flex flex-wrap items-center gap-2">
            {(['subscriber', 'creator', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={roleBusy || user.role === r}
                className={[
                  'px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors disabled:cursor-default',
                  user.role === r
                    ? 'bg-brand-purple-700 text-white border-brand-purple-700'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50',
                ].join(' ')}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
            {roleBusy && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
          </div>
        </div>

        {/* Course access */}
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-neutral-700 uppercase tracking-wide mb-2">שיוך קורסים</h3>

          {loading ? (
            <div className="flex items-center gap-2 text-neutral-500 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> טוען…
            </div>
          ) : (
            <>
              <select
                value={assignId}
                onChange={(e) => { const v = e.target.value; setAssignId(v); void assign(v); }}
                disabled={available.length === 0}
                className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
              >
                <option value="">
                  {available.length === 0 ? 'כל הקורסים כבר משויכים' : 'בחר קורס לשיוך…'}
                </option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              {/* Assigned tags */}
              <div className="mt-3 flex flex-wrap gap-2">
                {(data?.grants ?? []).length === 0 ? (
                  <p className="text-sm text-neutral-500">אין קורסים משויכים עדיין.</p>
                ) : (
                  (data?.grants ?? []).map((g) => (
                    <span
                      key={`${g.kind}-${g.resource_id}`}
                      className="inline-flex items-center gap-1.5 ps-3 pe-1.5 py-1 rounded-pill bg-brand-purple-100 text-brand-purple-800 text-xs font-semibold"
                    >
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="max-w-[200px] truncate">{g.title}</span>
                      <span className="text-[10px] font-normal text-brand-purple-500">
                        {SOURCE_LABEL[g.source] ?? g.source}
                      </span>
                      <button
                        type="button"
                        onClick={() => unassign(g)}
                        className="ms-0.5 grid place-items-center w-5 h-5 rounded-full hover:bg-brand-purple-200"
                        aria-label={`הסר שיוך ל${g.title}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Purchases */}
        <div className="mt-5">
          <h3 className="text-xs font-extrabold text-neutral-700 uppercase tracking-wide mb-2">רכישות</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-neutral-500 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> טוען…
            </div>
          ) : (
            <PurchasesTable rows={data?.purchases ?? []} compact emptyText="אין רכישות עדיין." />
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</div>
        )}

        <div className="mt-6 flex justify-start">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50"
          >
            סגור
          </button>
        </div>
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
  const [role, setRole] = useState<'admin' | 'subscriber' | 'creator'>('subscriber');
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
                  onChange={(e) => setRole(e.target.value as 'admin' | 'subscriber' | 'creator')}
                  className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
                >
                  <option value="subscriber">משתמש</option>
                  <option value="creator">יוצר</option>
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
