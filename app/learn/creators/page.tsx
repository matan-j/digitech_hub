import { Users } from 'lucide-react';
import { listCreators, getCreatorStats } from '@/lib/learn/db';
import CreatorsDirectory, { type DirectoryCreator } from '@/components/learn/CreatorsDirectory';

export const metadata = { title: 'יוצרים · DigiTech HUB' };
export const dynamic = 'force-dynamic';

export default async function CreatorsIndex() {
  const creators = await listCreators({ activeOnly: true });

  const cards: DirectoryCreator[] = await Promise.all(
    creators.map(async (creator) => {
      const stats = await getCreatorStats(creator.id, true);
      return { creator, guides: stats.guides, playlists: stats.playlists };
    }),
  );

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <Users className="w-4 h-4 text-brand-purple-700" />
          <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">יוצרים</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">היוצרים של Digitech</h1>
        <p className="text-sm text-neutral-700 mt-1.5">הכירו את האנשים שמאחורי התוכן — הדרכות, פלייליסטים וידע פרקטי.</p>
      </header>

      <CreatorsDirectory creators={cards} />
    </div>
  );
}
