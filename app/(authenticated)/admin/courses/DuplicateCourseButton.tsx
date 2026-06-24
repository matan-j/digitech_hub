'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';

export default function DuplicateCourseButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    if (!confirm('לשכפל את הקורס? ייווצר עותק חדש בסטטוס טיוטה.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/content/course/${slug}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.slug) {
        alert('שכפול נכשל. נסה שוב.');
        return;
      }
      router.push(`/admin/courses/${data.slug}`);
      router.refresh();
    } catch {
      alert('שגיאת רשת. נסה שוב.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={loading}
      title="שכפל קורס"
      className="p-1.5 rounded-md text-neutral-400 hover:text-brand-purple-700 hover:bg-brand-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Copy className="w-4 h-4" />
    </button>
  );
}
