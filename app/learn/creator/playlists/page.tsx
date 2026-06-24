import Link from 'next/link';
import { Plus, ListVideo } from 'lucide-react';
import { requireCreator } from '@/lib/auth';
import { listPlaylistsByCreator, getPlaylistItemCounts } from '@/lib/learn/db';
import CreatorDashboardNav from '@/components/creator/CreatorDashboardNav';
import EmptyState from '@/components/learn/EmptyState';

export const metadata = { title: 'הפלייליסטים שלי · לוח יוצר' };
export const dynamic = 'force-dynamic';

export default async function CreatorPlaylistsPage() {
  const { creator } = await requireCreator('/learn/creator/playlists');
  const playlists = creator ? await listPlaylistsByCreator(creator.id, false) : [];
  const counts = await getPlaylistItemCounts(playlists.map((p) => p.id));

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 mb-6">לוח יוצר</h1>
      <CreatorDashboardNav />

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-neutral-950">הפלייליסטים שלי</h2>
        <Link href="/learn/creator/playlists/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> פלייליסט חדש
        </Link>
      </div>

      {playlists.length === 0 ? (
        <EmptyState icon={ListVideo} title="אין עדיין פלייליסטים" message="ארגן את ההדרכות שלך לסדרות נושאיות." cta={{ label: 'פלייליסט חדש', href: '/learn/creator/playlists/new' }} />
      ) : (
        <div className="bg-white rounded-card border border-neutral-200 overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">כותרת</th>
                <th className="text-right px-4 py-3 font-semibold">הדרכות</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/learn/creator/playlists/${p.id}`} className="font-semibold text-neutral-900 hover:text-brand-purple-700">{p.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{counts[p.id] ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={['inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold', p.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'].join(' ')}>
                      {p.status === 'published' ? 'פורסם' : 'טיוטה'}
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
