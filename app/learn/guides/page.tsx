import { Compass } from 'lucide-react';
import {
  listPublishedGuides,
  listFeaturedGuides,
  listFeaturedCreators,
  listFeaturedPlaylists,
  getCreatorStats,
  getPlaylistItemCounts,
} from '@/lib/learn/db';
import GuidesHub, { type HubCreator, type HubPlaylist, type HubCategory } from '@/components/learn/GuidesHub';

export const metadata = { title: 'הדרכות · DigiTech HUB' };
export const dynamic = 'force-dynamic';

export default async function GuidesIndex() {
  const [guides, featuredGuides, featuredCreators, featuredPlaylists] = await Promise.all([
    listPublishedGuides(),
    listFeaturedGuides(6),
    listFeaturedCreators(6),
    listFeaturedPlaylists(6),
  ]);

  // Creator counts (published) for featured cards.
  const creatorCards: HubCreator[] = await Promise.all(
    featuredCreators.map(async (creator) => {
      const stats = await getCreatorStats(creator.id, true);
      return { creator, guides: stats.guides, playlists: stats.playlists };
    }),
  );

  // Playlist item counts.
  const playlistCounts = await getPlaylistItemCounts(featuredPlaylists.map((p) => p.id));
  const playlistCards: HubPlaylist[] = featuredPlaylists.map((playlist) => ({
    playlist,
    count: playlistCounts[playlist.id] ?? 0,
  }));

  // Categories used by published guides (for the filter row).
  const catMap = new Map<string, HubCategory>();
  for (const g of guides) {
    for (const c of g.categories ?? []) {
      if (!catMap.has(c.id)) catMap.set(c.id, { id: c.id, name: c.name });
    }
  }
  const categories = Array.from(catMap.values());

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <Compass className="w-4 h-4 text-brand-purple-700" />
          <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">הדרכות</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">הדרכות</h1>
        <p className="text-sm text-neutral-700 mt-1.5">הדרכות פרקטיות, סרטונים וקבצי PDF ללמידה עצמאית.</p>
      </header>

      <GuidesHub
        featuredGuides={featuredGuides}
        creators={creatorCards}
        playlists={playlistCards}
        guides={guides}
        categories={categories}
      />
    </div>
  );
}
