'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink } from 'lucide-react';
import FileUpload from './FileUpload';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import YouTubeField from './YouTubeField';
import CategoriesPicker from './CategoriesPicker';
import AccessControlFields from './AccessControlFields';
import { DOMAINS, type DomainId, isDomainId } from '@/lib/learn/domains';
import type { AccessLevel, CatalogVisibility, Playbook } from '@/lib/learn/types';

type Props = { initial: Playbook };

export default function PlaybookEditor({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [audience, setAudience] = useState(initial.audience ?? '');
  const [coverUrl, setCoverUrl] = useState(initial.cover_url ?? '');
  const [videoUrl, setVideoUrl] = useState(initial.video_url ?? '');
  const [domain, setDomain] = useState<DomainId | null>(initial.domain ?? null);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    (initial.categories ?? []).map((c) => c.id),
  );
  const [isPremium, setIsPremium] = useState(initial.is_premium);
  const [status, setStatus] = useState(initial.status);
  const [htmlContent, setHtmlContent] = useState(initial.html_content ?? '');
  // Access model (migration 018)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(initial.access_level ?? 'open');
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>(initial.catalog_visibility ?? 'public');
  const [previewEnabled, setPreviewEnabled] = useState(initial.preview_enabled ?? false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const persist = useCallback(async (payload: Record<string, unknown>) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/admin/playbooks/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveState('error');
        console.error('[playbook:save]', data);
        return false;
      }
      void data;
      setSaveState('saved');
      dirty.current = false;
      return true;
    } catch (err) {
      console.error('[playbook:save]', err);
      setSaveState('error');
      return false;
    }
  }, [initial.id]);

  function buildPayload(extra?: Record<string, unknown>) {
    return {
      title,
      tagline: tagline || null,
      description: description || null,
      audience: audience || null,
      cover_url: coverUrl || null,
      video_url: videoUrl || null,
      domain,
      category_ids: categoryIds,
      is_premium: isPremium,
      html_content: htmlContent,
      access_level: accessLevel,
      catalog_visibility: catalogVisibility,
      preview_enabled: previewEnabled,
      ...extra,
    };
  }

  useEffect(() => {
    if (!dirty.current) {
      dirty.current = true;
      return;
    }
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(buildPayload());
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, tagline, description, audience, coverUrl, videoUrl, domain, categoryIds, isPremium, htmlContent, accessLevel, catalogVisibility, previewEnabled]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const saveNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void persist(buildPayload());
  }, [persist]);

  async function togglePublish() {
    const next = status === 'published' ? 'draft' : 'published';
    const ok = await persist(buildPayload({ status: next }));
    if (ok) setStatus(next);
  }

  async function handleDelete() {
    if (!confirm('למחוק את הפלייבוק לצמיתות?')) return;
    const res = await fetch(`/api/admin/playbooks/${initial.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/playbooks');
  }

  const publicUrl = initial.slug ? `/learn/playbooks/${initial.slug}` : `/learn/playbooks/${initial.id}`;

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start gap-4 justify-between mb-4">
          <div className="flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת הפלייבוק"
              className="w-full text-2xl font-extrabold text-neutral-950 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
            />
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="תיאור קצר (tagline)"
              className="mt-2 w-full text-sm text-neutral-600 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
            />
          </div>
          <div className="flex flex-col items-end gap-2">
            <SaveIndicator state={saveState} onForceSave={saveNow} initialSavedAt={initial.updated_at} />
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-purple-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              צפה כלומד
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={togglePublish}
            className={[
              'px-4 py-1.5 rounded-pill text-xs font-semibold transition-colors',
              status === 'published'
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-brand-purple-700 text-white hover:bg-brand-purple-600',
            ].join(' ')}
          >
            {status === 'published' ? '✓ פורסם — לחץ לביטול' : 'פרסם'}
          </button>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand-purple-700"
            />
            <span className="font-medium text-neutral-700">תוכן פרימיום (דורש מנוי)</span>
          </label>

          <button
            type="button"
            onClick={handleDelete}
            className="ms-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחק
          </button>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">וידאו וקאבר</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">קישור YouTube (אופציונלי)</label>
            <YouTubeField
              value={videoUrl}
              onChange={setVideoUrl}
              onUseThumbnail={(thumb) => setCoverUrl(thumb)}
              thumbnailAlreadyUsed={!!coverUrl && coverUrl.includes('ytimg.com')}
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              אם תזין URL של YouTube — הוא יוצג בראש הפלייבוק כסרטון, ותוכל למשוך את הקאבר אוטומטית.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">תמונת קאבר</label>
            <FileUpload
              bucket="covers"
              preview={coverUrl}
              onUploaded={(r) => setCoverUrl(r.url)}
            />
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl('')}
                className="mt-1.5 text-[11px] text-neutral-400 hover:text-red-600"
              >
                הסר קאבר
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">סיווג</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">תחום</label>
            <select
              value={domain ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setDomain(null);
                  setCategoryIds([]);
                } else if (isDomainId(v)) {
                  setDomain(v);
                  setCategoryIds([]);
                }
              }}
              className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
            >
              <option value="">— ללא תחום —</option>
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">קטגוריות</label>
            <CategoriesPicker domain={domain} value={categoryIds} onChange={setCategoryIds} />
          </div>
        </div>
      </section>

      <AccessControlFields
        accessLevel={accessLevel}
        onAccessLevel={setAccessLevel}
        catalogVisibility={catalogVisibility}
        onCatalogVisibility={setCatalogVisibility}
        previewEnabled={previewEnabled}
        onPreviewEnabled={setPreviewEnabled}
      />

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">מטא-דאטה</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">תיאור ארוך (description)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">קהל יעד</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="לדוגמה: מנהלי מכירות"
              className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
            />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">תוכן הפלייבוק (HTML)</h2>
        <p className="text-xs text-neutral-500 mb-3">
          הדבק כאן HTML מלא של הפלייבוק (כולל style/heebo). הוא ייטען ב-iframe sandboxed.
          השאר ריק אם הסרטון לבדו הוא התוכן.
        </p>
        <textarea
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          rows={16}
          dir="ltr"
          spellCheck={false}
          className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-xs font-mono"
          placeholder={'<!doctype html>\n<html lang="he" dir="rtl">\n<head>...</head>\n<body>...</body>\n</html>'}
        />
      </section>
    </div>
  );
}
