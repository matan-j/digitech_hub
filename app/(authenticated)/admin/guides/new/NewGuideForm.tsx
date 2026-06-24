'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewGuideForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/content/guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug: slug || undefined, tagline: tagline || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'create_failed');
      setLoading(false);
      return;
    }
    router.push(`/admin/guides/${data.item.slug}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl border border-neutral-200 p-6">
      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">כותרת</label>
        <input
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: איך לבנות סוכן AI ראשון"
          className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
          Slug (אופציונלי)
          <span className="text-xs font-normal text-neutral-500 ms-2">אם ריק — נוצר אוטומטית מהכותרת</span>
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ai-agent-first-build"
          dir="ltr"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">תיאור קצר (Tagline)</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="תיאור של שורה אחת שמופיע בכרטיס"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
        >
          {loading ? 'יוצר...' : 'צור והמשך לעורך'}
        </button>
        <span className="text-xs text-neutral-500">כל השדות — כולל הכותרת, הקישור והתוכן — ניתנים לעריכה בכל שלב בעורך.</span>
      </div>
    </form>
  );
}
