import Link from 'next/link';
import { ListVideo, Layers } from 'lucide-react';
import { listPlaylists, getPlaylistItemCounts } from '@/lib/learn/db';
import { DOMAIN_BY_ID } from '@/lib/learn/domains';
import EmptyState from '@/components/learn/EmptyState';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'פלייליסטים — DigiTech Learning Hub',
  description: 'אוספי תוכן מובחרים מהיוצרים שלנו.',
};

export default async function PlaylistsIndexPage() {
  const playlists = await listPlaylists({ publishedOnly: true });
  const counts = await getPlaylistItemCounts(playlists.map((p) => p.id));

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-[12px] font-semibold bg-brand-purple-50 text-brand-purple-700 mb-3">
          <ListVideo className="w-3.5 h-3.5" />
          פלייליסטים
        </span>
        <h1 className="text-3xl font-extrabold text-neutral-950">אוספים מובחרים</h1>
        <p className="mt-2 text-neutral-500">מסלולי תוכן שהיוצרים שלנו אספו עבורכם.</p>
      </header>

      {playlists.length === 0 ? (
        <EmptyState
          icon={ListVideo}
          title="אין פלייליסטים עדיין"
          message="בקרוב יתווספו כאן אוספי תוכן מהיוצרים."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => {
            const domain = p.domain ? DOMAIN_BY_ID[p.domain] : null;
            const count = counts[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="group relative flex flex-col bg-white rounded-card border border-neutral-200 overflow-hidden hover:border-brand-purple-700 transition-colors"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div
                  className="aspect-[16/9] relative"
                  style={
                    p.thumbnail_url
                      ? { backgroundImage: `url(${p.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }
                  }
                >
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-bold bg-white/90 text-neutral-700">
                    <Layers className="w-3 h-3" />
                    {count} פריטים
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  {domain && <span className="text-[11px] font-bold text-brand-purple-600 mb-1.5">{domain.label}</span>}
                  <h3 className="font-extrabold text-neutral-950 group-hover:text-brand-purple-700 transition-colors leading-snug line-clamp-2">
                    <Link href={`/learn/playlists/${p.id}`} className="after:absolute after:inset-0 after:content-['']">
                      {p.title}
                    </Link>
                  </h3>
                  {p.description && <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2">{p.description}</p>}
                  {p.creator && (
                    <Link
                      href={`/learn/creators/${p.creator.slug}`}
                      className="relative z-10 mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-brand-purple-700 transition-colors w-fit"
                    >
                      <span className="w-5 h-5 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                        {p.creator.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.creator.name.charAt(0)
                        )}
                      </span>
                      מאת {p.creator.name}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
