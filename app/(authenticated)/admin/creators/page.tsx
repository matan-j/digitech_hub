import Link from 'next/link';
import { Plus, Users, Star } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { listCreators, getCreatorStats } from '@/lib/learn/db';
import ContentTabs from '@/components/learn-admin/ContentTabs';
import DeleteRowButton from '@/components/learn-admin/DeleteRowButton';

export const metadata = { title: 'ניהול יוצרים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function CreatorsAdminPage() {
  const creators = await listCreators();

  // Resolve assigned-user emails + counts.
  const admin = createServiceClient();
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? null]));

  const rows = await Promise.all(
    creators.map(async (c) => ({ creator: c, stats: await getCreatorStats(c.id, false) })),
  );

  return (
    <div className="px-8 py-8 max-w-5xl">
      <ContentTabs />
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-950">יוצרים</h1>
          <p className="text-sm text-neutral-500 mt-1">צור ונהל פרופילי יוצרים, שייך משתמש פלטפורמה והגדר Featured.</p>
        </div>
        <Link
          href="/admin/creators/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> יוצר חדש
        </Link>
      </header>

      {creators.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-neutral-900 mb-1">אין עדיין יוצרים</h3>
          <p className="text-sm text-neutral-500 mb-4">צור יוצר ראשון ושייך לו משתמש כדי שיוכל לפרסם תוכן.</p>
          <Link
            href="/admin/creators/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> צור יוצר חדש
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">יוצר</th>
                <th className="text-right px-4 py-3 font-semibold">משתמש משויך</th>
                <th className="text-right px-4 py-3 font-semibold">הדרכות</th>
                <th className="text-right px-4 py-3 font-semibold">פלייליסטים</th>
                <th className="text-right px-4 py-3 font-semibold">Featured</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ creator, stats }) => (
                <tr key={creator.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/creators/${creator.id}`} className="flex items-center gap-2.5 font-semibold text-neutral-900 hover:text-brand-purple-700">
                      <span className="w-8 h-8 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                        {creator.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          creator.name.charAt(0)
                        )}
                      </span>
                      {creator.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs" dir="ltr">
                    {creator.user_id ? (emailById.get(creator.user_id) ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{stats.guides}</td>
                  <td className="px-4 py-3 text-neutral-700">{stats.playlists}</td>
                  <td className="px-4 py-3">
                    {creator.is_featured ? <Star className="w-4 h-4 text-gold fill-gold" style={{ color: 'var(--color-gold)' }} /> : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold',
                        creator.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700',
                      ].join(' ')}
                    >
                      {creator.status === 'active' ? 'פעיל' : 'מושבת'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DeleteRowButton
                      endpoint={`/api/admin/creators/${creator.id}`}
                      label={creator.name}
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
