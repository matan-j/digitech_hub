'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Product types creatable from this page. Only 'bundle' for now — more types
// (e.g. live workshop, resource pack) will be added here later.
const PRODUCT_TYPES = [{ value: 'bundle', label: 'באנדל — חבילת קורסים' }] as const;

export default function NewProductForm() {
  const router = useRouter();
  const [productType, setProductType] = useState<(typeof PRODUCT_TYPES)[number]['value']>('bundle');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/content/${productType}`, {
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
    router.push(`/admin/products/${data.item.slug}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl border border-neutral-200 p-6">
      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">סוג מוצר</label>
        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value as typeof productType)}
          className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm bg-white"
        >
          {PRODUCT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">כותרת</label>
        <input
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: חבילת AI מלאה"
          className="w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
          Slug
          <span className="text-xs font-normal text-neutral-500 ms-2">אם ריק — נוצר אוטומטית</span>
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ai-bundle"
          dir="ltr"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-neutral-800 mb-1.5">תיאור קצר</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="תיאור של שורה אחת"
          className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white font-semibold transition-colors"
      >
        {loading ? 'יוצר...' : 'צור והמשך'}
      </button>
    </form>
  );
}
