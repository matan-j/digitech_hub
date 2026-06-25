'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSlugSuggestion } from '@/lib/hooks/useSlugSuggestion';

export default function NewCreatorForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-translate the name to a slug until the admin edits the slug by hand.
  const { suggestion, loading: slugLoading } = useSlugSuggestion(name, 'creator', { enabled: !slugTouched });
  useEffect(() => {
    if (!slugTouched) setSlug(suggestion);
  }, [suggestion, slugTouched]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug: slug || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? 'create_failed');
      setLoading(false);
      return;
    }
    router.push(`/admin/creators/${data.item.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl border border-neutral-200 p-6">
      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">שם היוצר</label>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: Matan Jacobson"
          className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
          Slug (אופציונלי)
          <span className="text-xs font-normal text-neutral-500 ms-2">
            {slugLoading ? 'מתרגם את השם…' : 'מתורגם אוטומטית מהשם — ניתן לעריכה'}
          </span>
        </label>
        <input
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          placeholder="matan-jacobson"
          dir="ltr"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm font-mono"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
      >
        {loading ? 'יוצר...' : 'צור והמשך לעריכה'}
      </button>
    </form>
  );
}
