'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, ShieldX } from 'lucide-react';

type Course = { id: string; slug: string; title: string; access_level: string };
type UserLite = { id: string; email: string; full_name: string | null };
type Grant = {
  id: string;
  kind: 'entitlement' | 'enrollment';
  user_id: string;
  user_email: string | null;
  resource_type: string;
  resource_id: string;
  title: string;
  source: string;
  status: string;
  granted_at: string;
};
type Order = {
  id: string;
  public_order_id: string;
  user_id: string;
  user_email: string | null;
  content_type: string;
  content_id: string;
  title: string;
  amount: number;
  original_amount: number | null;
  currency: string;
  status: string;
  request_webhook_status: string;
  created_at: string;
};
type Data = { courses: Course[]; users: UserLite[]; grants: Grant[]; orders: Order[] };

const SOURCE_LABEL: Record<string, string> = {
  free: 'הרשמה חינמית',
  purchase: 'רכישה',
  admin: 'הענקת מנהל',
  migration: 'מיגרציה',
  gift: 'מתנה',
};
const SOURCE_CLS: Record<string, string> = {
  free: 'bg-sky-100 text-sky-800',
  purchase: 'bg-emerald-100 text-emerald-800',
  admin: 'bg-brand-purple-100 text-brand-purple-800',
  migration: 'bg-neutral-100 text-neutral-700',
  gift: 'bg-amber-100 text-amber-800',
};
const WEBHOOK_CLS: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-800',
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s));
}

export default function AccessConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [granting, setGranting] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/access');
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function grant() {
    if (!userId || !courseId) return;
    setGranting(true);
    setMsg(null);
    const res = await fetch('/api/admin/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resourceType: 'course', resourceId: courseId }),
    });
    setGranting(false);
    if (res.ok) { setMsg('הגישה הוענקה.'); setCourseId(''); await load(); }
    else setMsg('שגיאה בהענקת גישה.');
  }

  async function revoke(g: Grant) {
    if (!confirm(`לשלול גישה ל"${g.title}" מ-${g.user_email}? התקדמות הלמידה תישמר.`)) return;
    setBusyRow(g.id);
    const res = await fetch('/api/admin/access', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: g.kind, userId: g.user_id, resourceType: g.resource_type, resourceId: g.resource_id }),
    });
    setBusyRow(null);
    if (res.ok) await load();
    else setMsg('שגיאה בשלילת הגישה.');
  }

  if (loading || !data) {
    return <div className="flex items-center gap-2 text-neutral-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> טוען…</div>;
  }

  const activeGrants = data.grants.filter((g) => g.status === 'active');
  const pendingOrders = data.orders.filter((o) => o.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Manual grant */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">הענקת גישה ידנית</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">משתמש</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-neutral-200 text-sm bg-white">
              <option value="">בחר משתמש…</option>
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>{u.email}{u.full_name ? ` — ${u.full_name}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">קורס</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-neutral-200 text-sm bg-white">
              <option value="">בחר קורס…</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={grant}
            disabled={!userId || !courseId || granting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
          >
            {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            הענק גישה
          </button>
          {msg && <span className="text-xs text-neutral-600">{msg}</span>}
        </div>
      </section>

      {/* Pending purchase requests */}
      <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide">
            בקשות רכישה ממתינות <span className="text-neutral-400 font-normal">({pendingOrders.length})</span>
          </h2>
        </div>
        {pendingOrders.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">אין בקשות רכישה ממתינות.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500 bg-neutral-50">
                <tr>
                  <th className="text-start px-4 py-2 font-semibold">מס׳ הזמנה</th>
                  <th className="text-start px-4 py-2 font-semibold">משתמש</th>
                  <th className="text-start px-4 py-2 font-semibold">מוצר</th>
                  <th className="text-start px-4 py-2 font-semibold">מחיר</th>
                  <th className="text-start px-4 py-2 font-semibold">Webhook</th>
                  <th className="text-start px-4 py-2 font-semibold">תאריך</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pendingOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-mono text-xs" dir="ltr">{o.public_order_id}</td>
                    <td className="px-4 py-2">{o.user_email}</td>
                    <td className="px-4 py-2">{o.title}</td>
                    <td className="px-4 py-2 tabular-nums">₪{o.amount}{o.original_amount && o.original_amount > o.amount ? <span className="ms-1 text-xs text-neutral-400 line-through">₪{o.original_amount}</span> : null}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${WEBHOOK_CLS[o.request_webhook_status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                        {o.request_webhook_status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Active access grants */}
      <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide">
            גישות פעילות <span className="text-neutral-400 font-normal">({activeGrants.length})</span>
          </h2>
        </div>
        {activeGrants.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">אין גישות פעילות.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500 bg-neutral-50">
                <tr>
                  <th className="text-start px-4 py-2 font-semibold">משתמש</th>
                  <th className="text-start px-4 py-2 font-semibold">קורס / תוכן</th>
                  <th className="text-start px-4 py-2 font-semibold">מקור</th>
                  <th className="text-start px-4 py-2 font-semibold">תאריך</th>
                  <th className="text-start px-4 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {activeGrants.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-2">{g.user_email}</td>
                    <td className="px-4 py-2">{g.title}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${SOURCE_CLS[g.source] ?? 'bg-neutral-100 text-neutral-700'}`}>
                        {SOURCE_LABEL[g.source] ?? g.source}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(g.granted_at)}</td>
                    <td className="px-4 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => revoke(g)}
                        disabled={busyRow === g.id}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busyRow === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldX className="w-3.5 h-3.5" />}
                        שלילת גישה
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
