import Link from 'next/link';
import { Plus, BookOpen } from 'lucide-react';
import { requireCreator } from '@/lib/auth';
import { listGuidesByCreator } from '@/lib/learn/db';
import CreatorDashboardNav from '@/components/creator/CreatorDashboardNav';
import EmptyState from '@/components/learn/EmptyState';
import { CONTENT_KIND_LABEL } from '@/lib/learn/placeholder';

export const metadata = { title: 'ההדרכות שלי · לוח יוצר' };
export const dynamic = 'force-dynamic';

export default async function CreatorGuidesPage() {
  const { creator } = await requireCreator('/learn/creator/guides');
  const guides = creator ? await listGuidesByCreator(creator.id, false) : [];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 mb-6">לוח יוצר</h1>
      <CreatorDashboardNav />

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-neutral-950">ההדרכות שלי</h2>
        <Link href="/learn/creator/guides/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> הדרכה חדשה
        </Link>
      </div>

      {guides.length === 0 ? (
        <EmptyState icon={BookOpen} title="אין עדיין הדרכות" message="צור את ההדרכה הראשונה שלך כדי להתחיל." cta={{ label: 'הדרכה חדשה', href: '/learn/creator/guides/new' }} />
      ) : (
        <div className="bg-white rounded-card border border-neutral-200 overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">כותרת</th>
                <th className="text-right px-4 py-3 font-semibold">סוג</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => (
                <tr key={g.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/learn/creator/guides/${g.slug}`} className="font-semibold text-neutral-900 hover:text-brand-purple-700">
                      {g.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{CONTENT_KIND_LABEL[g.content_kind ?? 'article']}</td>
                  <td className="px-4 py-3">
                    <span className={['inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold', g.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'].join(' ')}>
                      {g.status === 'published' ? 'פורסם' : 'טיוטה'}
                    </span>
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
