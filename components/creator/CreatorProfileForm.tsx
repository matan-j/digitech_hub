'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FileUpload from '@/components/learn-admin/FileUpload';
import SaveIndicator, { type SaveState } from '@/components/learn-admin/SaveIndicator';
import SocialLinks from '@/components/learn/SocialLinks';
import type { Creator } from '@/lib/learn/types';

const SOCIAL_FIELDS: { key: keyof Creator; label: string; placeholder: string }[] = [
  { key: 'website', label: 'אתר', placeholder: 'https://example.com' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { key: 'email', label: 'אימייל ציבורי', placeholder: 'name@example.com' },
  { key: 'contact_email', label: 'אימייל ליצירת קשר', placeholder: 'support@example.com' },
];

const SELF_FIELDS = [
  'name', 'avatar_url', 'banner_url', 'bio', 'role_title', 'intro_video_url',
  'website', 'linkedin', 'instagram', 'youtube', 'tiktok', 'email', 'contact_email',
  'seo_title', 'seo_description', 'og_image_url',
] as const;

export default function CreatorProfileForm({ initial }: { initial: Creator }) {
  const [form, setForm] = useState<Creator>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  function set<K extends keyof Creator>(key: K, value: Creator[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const persist = useCallback(async () => {
    setSaveState('saving');
    const payload: Record<string, unknown> = {};
    for (const f of SELF_FIELDS) payload[f] = (form as Record<string, unknown>)[f] ?? null;
    try {
      const res = await fetch('/api/creator/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setSaveState('error'); return; }
      setSaveState('saved');
      dirty.current = false;
    } catch {
      setSaveState('error');
    }
  }, [form]);

  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist(); }, 1000);
  }, [form, persist]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist();
  }, [persist]);

  const labelCls = 'block text-xs font-semibold text-neutral-600 mb-1.5';
  const inputCls = 'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm';

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center justify-between gap-4">
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="שם היוצר"
          className="flex-1 text-2xl font-extrabold text-neutral-950 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
        />
        <SaveIndicator state={saveState} onForceSave={saveNow} initialSavedAt={initial.updated_at} />
      </header>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>אווטאר / לוגו</label>
          <FileUpload bucket="covers" preview={form.avatar_url} onUploaded={(r) => set('avatar_url', r.url)} />
        </div>
        <div>
          <label className={labelCls}>תמונת באנר</label>
          <FileUpload bucket="covers" preview={form.banner_url} onUploaded={(r) => set('banner_url', r.url)} />
        </div>
        <div>
          <label className={labelCls}>תפקיד / כותרת</label>
          <input value={form.role_title ?? ''} onChange={(e) => set('role_title', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>ביוגרפיה קצרה</label>
          <textarea value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={3} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>סרטון היכרות (YouTube / Vimeo)</label>
          <input
            value={form.intro_video_url ?? ''}
            onChange={(e) => set('intro_video_url', e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            dir="ltr"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[11px] text-neutral-400 mt-1">יוצג בקטע &quot;הכירו את היוצר&quot; בפרופיל הציבורי. השאר ריק כדי להסתיר.</p>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">רשתות חברתיות ויצירת קשר</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map((s) => (
            <div key={s.key}>
              <label className={labelCls}>{s.label}</label>
              <input
                value={(form[s.key] as string | null) ?? ''}
                onChange={(e) => set(s.key, e.target.value as Creator[typeof s.key])}
                placeholder={s.placeholder}
                dir="ltr"
                className={`${inputCls} font-mono`}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-2">
          <span className="text-xs text-neutral-500">תצוגה מקדימה:</span>
          <SocialLinks socials={form} size="sm" />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>SEO Title</label>
          <input value={form.seo_title ?? ''} onChange={(e) => set('seo_title', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>SEO Description</label>
          <input value={form.seo_description ?? ''} onChange={(e) => set('seo_description', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>תמונת OG</label>
          <input value={form.og_image_url ?? ''} onChange={(e) => set('og_image_url', e.target.value)} dir="ltr" className={`${inputCls} font-mono`} placeholder="https://…" />
        </div>
      </section>
    </div>
  );
}
