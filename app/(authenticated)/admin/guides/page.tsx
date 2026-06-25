import Link from 'next/link';
import { listContent } from '@/lib/learn/db';
import { Plus, FileText } from 'lucide-react';
import ContentTabs from '@/components/learn-admin/ContentTabs';
import DeleteRowButton from '@/components/learn-admin/DeleteRowButton';

export const metadata = { title: 'ניהול הדרכות — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function GuidesAdminIndex() {
  const items = await listContent('guide');

  return (
    <div className="px-8 py-8 max-w-5xl">
      <ContentTabs />
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-950">הדרכות</h1>
          <p className="text-sm text-neutral-500 mt-1">תוכן ארוך עם markdown, תמונות וקישורים.</p>
        </div>
        <Link
          href="/admin/guides/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> הדרכה חדשה
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-neutral-900 mb-1">עוד אין הדרכות</h3>
          <p className="text-sm text-neutral-500 mb-4">צור הדרכה ראשונה כדי להתחיל.</p>
          <Link
            href="/admin/guides/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> צור הדרכה חדשה
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">כותרת</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
                <th className="text-right px-4 py-3 font-semibold">מנוי</th>
                <th className="text-right px-4 py-3 font-semibold">עודכן</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr key={g.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/guides/${g.slug}`} className="font-semibold text-neutral-900 hover:text-brand-purple-700">
                      {g.title}
                    </Link>
                    {g.tagline && <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-md">{g.tagline}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold',
                        g.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700',
                      ].join(' ')}
                    >
                      {g.status === 'published' ? 'פורסם' : 'טיוטה'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold',
                        g.is_premium ? 'bg-brand-purple-100 text-brand-purple-800' : 'bg-neutral-100 text-neutral-600',
                      ].join(' ')}
                    >
                      {g.is_premium ? 'פרימיום' : 'חינמי'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(g.updated_at)}</td>
                  <td className="px-4 py-3">
                    <DeleteRowButton
                      endpoint={`/api/content/guide/${g.slug}`}
                      label={g.title}
                    />
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
