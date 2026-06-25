import { listPlaybooks } from '@/lib/learn/db';
import { BookText } from 'lucide-react';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import LearnFilters, { type FilterableItem } from '@/components/learn/LearnFilters';

export const metadata = { title: 'פלייבוקים · DigiTech HUB' };
export const dynamic = 'force-dynamic';

export default async function PlaybooksLearnerIndex() {
  const [items, auth] = await Promise.all([listPlaybooks(), getCurrentUser()]);
  // RLS already filters non-published playbooks for non-admins. Still: hide drafts from any list view.
  const visible = items.filter((p) => p.status === 'published');
  const canSeePremium = auth ? hasPremiumAccess(auth.profile) : false;

  const cards: FilterableItem[] = visible.map((p) => ({
    id: p.id,
    href: p.slug ? `/learn/playbooks/${p.slug}` : `/learn/playbooks/${p.id}`,
    title: p.title,
    tagline: p.tagline,
    cover_url: p.cover_url,
    video_url: p.video_url,
    domain: p.domain,
    locked: p.is_premium && !canSeePremium,
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <BookText className="w-4 h-4 text-brand-purple-700" />
          <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">פלייבוקים</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">מדריכי-פעולה אינטראקטיביים</h1>
        <p className="text-sm text-neutral-700 mt-1.5">פלייבוקים מובנים — וידאו, צ&apos;קליסט, ותסריט עבודה בלחיצה אחת.</p>
      </header>

      <LearnFilters items={cards} variant="playbook" emptyText="עדיין אין פלייבוקים זמינים." />
    </div>
  );
}
