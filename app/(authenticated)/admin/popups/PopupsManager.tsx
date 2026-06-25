'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowRight, Clock, MousePointerClick, Globe, FileText } from 'lucide-react';
import { POPUP_CONTENT_TYPES, type Popup } from '@/lib/learn/popups';
import PopupEditor from './PopupEditor';

const typeLabel = (v: string) => POPUP_CONTENT_TYPES.find((t) => t.value === v)?.label ?? v;

export default function PopupsManager({ initialPopups }: { initialPopups: Popup[] }) {
  const [popups, setPopups] = useState<Popup[]>(initialPopups);
  // null = list view; 'new' = create; Popup = edit
  const [editing, setEditing] = useState<Popup | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function onSaved(saved: Popup) {
    setPopups((prev) => {
      const i = prev.findIndex((p) => p.id === saved.id);
      if (i === -1) return [saved, ...prev];
      const next = [...prev];
      next[i] = saved;
      return next;
    });
    setEditing(null);
  }

  async function toggleEnabled(p: Popup) {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/popups/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      const data = await res.json();
      if (res.ok) onSaved(data.item as Popup);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: Popup) {
    if (!window.confirm(`למחוק את הפופאפ "${p.name}"?`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/popups/${p.id}`, { method: 'DELETE' });
      if (res.ok) setPopups((prev) => prev.filter((x) => x.id !== p.id));
    } finally {
      setBusyId(null);
    }
  }

  if (editing) {
    return (
      <div>
        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 mb-5"
        >
          <ArrowRight className="w-4 h-4" /> חזרה לרשימה
        </button>
        <PopupEditor
          initial={editing === 'new' ? null : editing}
          onSaved={onSaved}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold"
        >
          <Plus className="w-4 h-4" /> פופאפ חדש
        </button>
      </div>

      {popups.length === 0 ? (
        <div className="bg-white rounded-card border border-brand-purple-200 p-12 text-center text-neutral-500">
          עדיין אין פופאפים. צור את הראשון.
        </div>
      ) : (
        <div className="bg-white rounded-card border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs">
              <tr>
                <th className="text-right font-semibold px-4 py-3">שם</th>
                <th className="text-right font-semibold px-4 py-3">סוג</th>
                <th className="text-right font-semibold px-4 py-3">תצוגה</th>
                <th className="text-right font-semibold px-4 py-3">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {popups.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50/60">
                  <td className="px-4 py-3 font-medium text-neutral-950">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-neutral-600">
                      <FileText className="w-3.5 h-3.5" /> {typeLabel(p.content_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        {p.trigger_type === 'time' ? <Clock className="w-3.5 h-3.5" /> : <MousePointerClick className="w-3.5 h-3.5" />}
                        {p.trigger_type === 'time' ? `${p.trigger_value} ש׳` : `${p.trigger_value}% גלילה`}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                        <Globe className="w-3 h-3" />
                        {p.scope === 'all' ? 'כל האתר' : p.target_path}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabled(p)}
                      disabled={busyId === p.id}
                      className={[
                        'px-2.5 py-1 rounded-pill text-xs font-semibold border transition-colors disabled:opacity-50',
                        p.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100',
                      ].join(' ')}
                    >
                      {p.enabled ? 'פעיל' : 'כבוי'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-2 rounded-md text-neutral-500 hover:bg-brand-purple-50 hover:text-brand-purple-700"
                        title="עריכה"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        disabled={busyId === p.id}
                        className="p-2 rounded-md text-neutral-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="מחיקה"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
