'use client';

import { useEffect, useState } from 'react';
import { Webhook, Loader2, Check, AlertTriangle } from 'lucide-react';

type Status = { configured: boolean; viewId: number | null; triggerType: string; hasSecret: boolean; url: string };
type Named = { id: number; name: string };

export default function SumitWebhookControl() {
  const [status, setStatus] = useState<Status | null>(null);
  const [folders, setFolders] = useState<Named[]>([]);
  const [views, setViews] = useState<Named[]>([]);
  const [folderId, setFolderId] = useState<string>('');
  const [viewId, setViewId] = useState<string>('');
  const [loadingViews, setLoadingViews] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Load config + folders on open.
  useEffect(() => {
    fetch('/api/admin/sumit/webhook')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => {
        setStatus(s);
        if (s?.viewId) setViewId(String(s.viewId));
      })
      .catch(() => {});
    fetch('/api/admin/sumit/webhook?action=folders')
      .then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d) => setFolders(d.folders ?? []))
      .catch(() => {});
  }, []);

  // Load views when a folder is chosen.
  useEffect(() => {
    if (!folderId) { setViews([]); return; }
    setLoadingViews(true);
    fetch(`/api/admin/sumit/webhook?action=views&folderId=${encodeURIComponent(folderId)}`)
      .then((r) => (r.ok ? r.json() : { views: [] }))
      .then((d) => setViews(d.views ?? []))
      .catch(() => setViews([]))
      .finally(() => setLoadingViews(false));
  }, [folderId]);

  async function register() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/sumit/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewId: viewId ? Number(viewId) : undefined, folderId: folderId ? Number(folderId) : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { kind: 'ok', text: `הוובהוק נרשם ב-SUMIT (View ${data.viewId}).` } : { kind: 'err', text: data.message ?? data.error ?? 'שגיאה' });
    } catch {
      setMsg({ kind: 'err', text: 'שגיאת רשת' });
    } finally {
      setBusy(false);
    }
  }

  async function unregister() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/sumit/webhook', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { kind: 'ok', text: 'הרישום הוסר.' } : { kind: 'err', text: data.message ?? data.error ?? 'שגיאה' });
    } catch {
      setMsg({ kind: 'err', text: 'שגיאת רשת' });
    } finally {
      setBusy(false);
    }
  }

  const canRegister = !!status?.configured && !!viewId && !busy;

  return (
    <details className="rounded-xl border border-neutral-200 bg-white p-4">
      <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-800">
        <Webhook className="w-4 h-4 text-brand-purple-700" />
        רישום וובהוק SUMIT (אוטומציה אחרי תשלום)
      </summary>

      <div className="mt-4 space-y-3 text-sm">
        <p className="text-neutral-600">
          רישום אוטומטי של הכתובת שלנו כטריגר ב-SUMIT — במקום הגדרה ידנית בדשבורד. בחר את התיקייה וה-View
          (&quot;נתונים לטריגר&quot;) ולחץ רישום. SUMIT ישלח כל תשלום מוצלח לכתובת זו.
        </p>

        {!status?.configured && status && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>SUMIT אינו מוגדר (חסר SUMIT_COMPANY_ID / SUMIT_API_KEY).</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">תיקייה</label>
            <select
              value={folderId}
              onChange={(e) => { setFolderId(e.target.value); setViewId(''); }}
              disabled={!status?.configured || folders.length === 0}
              className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white disabled:bg-neutral-50"
            >
              <option value="">{folders.length === 0 ? 'טוען…' : 'בחר תיקייה…'}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">
              View {loadingViews && <Loader2 className="inline w-3 h-3 animate-spin" />}
            </label>
            <select
              value={viewId}
              onChange={(e) => setViewId(e.target.value)}
              disabled={!folderId || views.length === 0}
              className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white disabled:bg-neutral-50"
            >
              <option value="">{!folderId ? 'בחר תיקייה קודם' : views.length === 0 ? 'אין Views' : 'בחר View…'}</option>
              {views.map((v) => <option key={v.id} value={v.id}>{v.name} (#{v.id})</option>)}
            </select>
          </div>
        </div>

        {status && (
          <p className="text-[11px] text-neutral-500 font-mono break-all" dir="ltr">{status.url}</p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={register}
            disabled={!canRegister}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            רשום וובהוק
          </button>
          <button
            type="button"
            onClick={unregister}
            disabled={busy || !status?.configured}
            className="px-4 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
          >
            הסר רישום
          </button>
        </div>

        {msg && (
          <div className={`rounded-md border p-2 text-xs ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {msg.text}
          </div>
        )}
      </div>
    </details>
  );
}
