'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSlugSuggestion } from '@/lib/hooks/useSlugSuggestion';

export default function NewPlaybookForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-translate the title to a slug until the admin edits the slug by hand.
  const { suggestion, loading: slugLoading } = useSlugSuggestion(title, 'playbook', { enabled: !slugTouched });
  useEffect(() => {
    if (!slugTouched) setSlug(suggestion);
  }, [suggestion, slugTouched]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/admin/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug: slug || undefined, tagline: tagline || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? 'create_failed');
      setLoading(false);
      return;
    }
    router.push(`/admin/playbooks/${data.item.id}`);
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
          placeholder="לדוגמה: Playbook: AI Sales Outreach"
          className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
          Slug (אופציונלי)
          <span className="text-xs font-normal text-neutral-500 ms-2">
            {slugLoading ? 'מתרגם את הכותרת…' : 'מתורגם אוטומטית מהכותרת — ניתן לעריכה'}
          </span>
        </label>
        <input
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          placeholder="ai-sales-outreach"
          dir="ltr"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">תיאור קצר (Tagline)</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="שורה אחת שתופיע בכרטיס"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
      >
        {loading ? 'יוצר...' : 'צור והמשך לעורך'}
      </button>
    </form>
  );
}
