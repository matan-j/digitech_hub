import Link from 'next/link';
import { Plus, ListVideo } from 'lucide-react';
import { listPlaylists, getPlaylistItemCounts } from '@/lib/learn/db';
import ContentTabs from '@/components/learn-admin/ContentTabs';

export const metadata = { title: 'ניהול פלייליסטים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function PlaylistsAdminPage() {
  const playlists = await listPlaylists();
  const counts = await getPlaylistItemCounts(playlists.map((p) => p.id));

  return (
    <div className="px-8 py-8 max-w-5xl">
      <ContentTabs />
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-950">פלייליסטים</h1>
          <p className="text-sm text-neutral-500 mt-1">אוספי הדרכות מאורגנים, מקובצים לפי יוצר.</p>
        </div>
        <Link
          href="/admin/playlists/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> פלייליסט חדש
        </Link>
      </header>

      {playlists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
            <ListVideo className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-neutral-900 mb-1">אין עדיין פלייליסטים</h3>
          <p className="text-sm text-neutral-500 mb-4">צור פלייליסט ושייך לו יוצר והדרכות.</p>
          <Link href="/admin/playlists/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> צור פלייליסט חדש
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">כותרת</th>
                <th className="text-right px-4 py-3 font-semibold">יוצר</th>
                <th className="text-right px-4 py-3 font-semibold">הדרכות</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/playlists/${p.id}`} className="font-semibold text-neutral-900 hover:text-brand-purple-700">{p.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{p.creator?.name ?? '—'}</td>
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
