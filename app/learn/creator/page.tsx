import Link from 'next/link';
import { BookOpen, ListVideo, Eye, Plus, ExternalLink } from 'lucide-react';
import { requireCreator } from '@/lib/auth';
import { getCreatorStats, listGuidesByCreator } from '@/lib/learn/db';
import CreatorDashboardNav from '@/components/creator/CreatorDashboardNav';
import EmptyState from '@/components/learn/EmptyState';

export const metadata = { title: 'לוח יוצר · DigiTech HUB' };
export const dynamic = 'force-dynamic';

function StatCard({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return (
    <div className="bg-white rounded-card border border-neutral-200 p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="w-10 h-10 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-700 mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-extrabold text-neutral-950" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{value}</p>
      <p className="text-sm text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

export default async function CreatorDashboard() {
  const { creator } = await requireCreator('/learn/creator');

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">לוח יוצר</h1>
        <p className="text-sm text-neutral-700 mt-1.5">נהל את הפרופיל, ההדרכות והפלייליסטים שלך.</p>
      </header>

      <CreatorDashboardNav />

      {!creator ? (
        <EmptyState
          icon={BookOpen}
          title="אינך משויך ליוצר"
          message="חשבון האדמין שלך אינו מקושר לפרופיל יוצר. נהל יוצרים מאזור הניהול."
          cta={{ label: 'ניהול יוצרים', href: '/admin/creators' }}
        />
      ) : (
        <DashboardBody creatorId={creator.id} creatorSlug={creator.slug} />
      )}
    </div>
  );
}

async function DashboardBody({ creatorId, creatorSlug }: { creatorId: string; creatorSlug: string }) {
  const [stats, guides] = await Promise.all([
    getCreatorStats(creatorId, false),
    listGuidesByCreator(creatorId, false),
  ]);
  const recent = guides.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={BookOpen} value={stats.guides} label="הדרכות" />
        <StatCard icon={ListVideo} value={stats.playlists} label="פלייליסטים" />
        <StatCard icon={Eye} value={stats.views} label="צפיות" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/learn/creator/guides/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> הדרכה חדשה
        </Link>
        <Link href="/learn/creator/playlists/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> פלייליסט חדש
        </Link>
        <Link href={`/learn/creators/${creatorSlug}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors">
          <ExternalLink className="w-4 h-4" /> צפה בפרופיל הציבורי
        </Link>
      </div>

      <section>
        <h2 className="text-lg font-extrabold text-neutral-950 mb-4">תוכן אחרון</h2>
        {recent.length === 0 ? (
          <EmptyState icon={BookOpen} title="אין עדיין הדרכות" message="צור את ההדרכה הראשונה שלך." cta={{ label: 'הדרכה חדשה', href: '/learn/creator/guides/new' }} compact />
        ) : (
          <div className="bg-white rounded-card border border-neutral-200 overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            {recent.map((g) => (
              <Link key={g.id} href={`/learn/creator/guides/${g.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <span className="font-medium text-neutral-900 truncate">{g.title}</span>
                <span className={['shrink-0 px-2 py-0.5 rounded-pill text-[11px] font-semibold', g.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'].join(' ')}>
                  {g.status === 'published' ? 'פורסם' : 'טיוטה'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
