'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function DeleteRowButton({
  endpoint,
  label,
}: {
  /** API endpoint to DELETE */
  endpoint: string;
  /** Item name shown in the confirmation dialog */
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`למחוק את "${label}"?\nפעולה זו אינה ניתנת לביטול.`)) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`מחיקה נכשלה: ${body?.message ?? res.status}`);
        return;
      }
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
      onClick={handleDelete}
      disabled={loading}
      title={`מחק את "${label}"`}
      className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
