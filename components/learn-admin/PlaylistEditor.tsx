'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ArrowUp, ArrowDown, Plus, X } from 'lucide-react';
import FileUpload from './FileUpload';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import AccessControlFields from './AccessControlFields';
import { DOMAINS, type DomainId, isDomainId } from '@/lib/learn/domains';
import type { Playlist, ContentItem, CatalogVisibility } from '@/lib/learn/types';

type GuideOption = { id: string; title: string };

export default function PlaylistEditor({
  initial,
  items,
  availableGuides,
  backHref = '/learn/creator/playlists',
}: {
  initial: Playlist;
  items: ContentItem[];
  availableGuides: GuideOption[];
  backHref?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [thumbnail, setThumbnail] = useState(initial.thumbnail_url ?? '');
  const [domain, setDomain] = useState<DomainId | null>(initial.domain ?? null);
  const [status, setStatus] = useState(initial.status);
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>(initial.catalog_visibility ?? 'public');
  const [orderedIds, setOrderedIds] = useState<string[]>(items.map((i) => i.id));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const titleById = new Map<string, string>([
    ...items.map((i) => [i.id, i.title] as const),
    ...availableGuides.map((g) => [g.id, g.title] as const),
  ]);

  const buildPayload = useCallback((extra?: Record<string, unknown>) => ({
    title,
    description: description || null,
    thumbnail_url: thumbnail || null,
    domain,
    catalog_visibility: catalogVisibility,
    content_item_ids: orderedIds,
    ...extra,
  }), [title, description, thumbnail, domain, catalogVisibility, orderedIds]);

  const persist = useCallback(async (payload: Record<string, unknown>) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/playlists/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setSaveState('error'); return false; }
      setSaveState('saved');
      dirty.current = false;
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [initial.id]);

  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist(buildPayload()); }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, thumbnail, domain, catalogVisibility, orderedIds]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist(buildPayload());
  }, [persist, buildPayload]);

  async function togglePublish() {
    const next = status === 'published' ? 'draft' : 'published';
    const ok = await persist(buildPayload({ status: next }));
    if (ok) setStatus(next);
  }

  async function handleDelete() {
    if (!confirm('למחוק את הפלייליסט?')) return;
    const res = await fetch(`/api/playlists/${initial.id}`, { method: 'DELETE' });
    if (res.ok) router.push(backHref);
  }

  function move(idx: number, dir: -1 | 1) {
    setOrderedIds((ids) => {
      const next = [...ids];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return ids;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function remove(id: string) { setOrderedIds((ids) => ids.filter((x) => x !== id)); }
  function add(id: string) { setOrderedIds((ids) => (ids.includes(id) ? ids : [...ids, id])); }

  const notAdded = availableGuides.filter((g) => !orderedIds.includes(g.id));
  const inputCls = 'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm';

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם הפלייליסט"
            className="flex-1 text-2xl font-extrabold text-neutral-950 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
          />
          <SaveIndicator state={saveState} onForceSave={saveNow} />
        </div>
        <div className="flex items-center gap-3 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={togglePublish}
            className={['px-4 py-1.5 rounded-pill text-xs font-semibold transition-colors', status === 'published' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-brand-purple-700 text-white hover:bg-brand-purple-600'].join(' ')}
          >
            {status === 'published' ? '✓ פורסם — לחץ לביטול' : 'פרסם'}
          </button>
          <button type="button" onClick={handleDelete} className="ms-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" /> מחק
          </button>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">תמונה</label>
          <FileUpload bucket="covers" preview={thumbnail} onUploaded={(r) => setThumbnail(r.url)} />
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">תחום</label>
            <select
              value={domain ?? ''}
              onChange={(e) => { const v = e.target.value; setDomain(v === '' ? null : isDomainId(v) ? v : null); }}
              className={`${inputCls} bg-white`}
            >
              <option value="">— ללא תחום —</option>
              {DOMAINS.map((d) => (<option key={d.id} value={d.id}>{d.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">תיאור</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </div>
        </div>
      </section>

      <AccessControlFields
        catalogVisibility={catalogVisibility}
        onCatalogVisibility={setCatalogVisibility}
      />

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">הדרכות בפלייליסט</h2>
        {orderedIds.length === 0 ? (
          <p className="text-sm text-neutral-500 mb-4">עדיין לא נוספו הדרכות. הוסף מהרשימה למטה.</p>
        ) : (
          <ol className="space-y-2 mb-4">
            {orderedIds.map((id, idx) => (
              <li key={id} className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-xs font-bold text-neutral-400 w-5 text-center">{idx + 1}</span>
                <span className="flex-1 text-sm font-medium text-neutral-800 truncate">{titleById.get(id) ?? id}</span>
                <button type="button" onClick={() => move(idx, -1)} className="p-1 text-neutral-400 hover:text-brand-purple-700" aria-label="הזז למעלה"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(idx, 1)} className="p-1 text-neutral-400 hover:text-brand-purple-700" aria-label="הזז למטה"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => remove(id)} className="p-1 text-neutral-400 hover:text-red-600" aria-label="הסר"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ol>
        )}

        {notAdded.length > 0 && (
          <div className="pt-3 border-t border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 mb-2">הוסף הדרכה</p>
            <div className="flex flex-wrap gap-2">
              {notAdded.map((g) => (
                <button key={g.id} type="button" onClick={() => add(g.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill text-xs font-medium bg-brand-purple-50 text-brand-purple-700 hover:bg-brand-purple-100 transition-colors">
                  <Plus className="w-3 h-3" /> {g.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
