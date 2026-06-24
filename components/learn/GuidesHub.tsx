'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X, Users, ListVideo, Compass, Sparkles, ArrowLeft, FileSearch } from 'lucide-react';
import GuideCard from './GuideCard';
import CreatorCard from './CreatorCard';
import PlaylistCard from './PlaylistCard';
import EmptyState from './EmptyState';
import type { ContentItem, Creator, Playlist } from '@/lib/learn/types';

export type HubCreator = { creator: Creator; guides: number; playlists: number };
export type HubPlaylist = { playlist: Playlist; count: number };
export type HubCategory = { id: string; name: string };

type Props = {
  featuredGuides: ContentItem[];
  creators: HubCreator[];
  playlists: HubPlaylist[];
  guides: ContentItem[];
  categories: HubCategory[];
};

function SectionHeader({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof Compass;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-950">
        <Icon className="w-5 h-5 text-brand-purple-700" />
        {title}
      </h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple-700 hover:text-brand-purple-600">
          הכל
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function GuidesHub({ featuredGuides, creators, playlists, guides, categories }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const isSearching = query.trim().length > 0 || activeCategory !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guides.filter((g) => {
      if (activeCategory && !(g.categories ?? []).some((c) => c.id === activeCategory)) return false;
      if (!q) return true;
      const hay = [
        g.title,
        g.tagline ?? '',
        g.description ?? '',
        g.creator?.name ?? '',
        ...(g.categories ?? []).map((c) => c.name),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [guides, query, activeCategory]);

  return (
    <div className="space-y-12">
      {/* Search + category filter */}
      <div className="space-y-4">
        <div className="relative max-w-xl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי כותרת, יוצר, קטגוריה…"
            className="w-full ps-10 pe-10 py-2.5 rounded-input border border-neutral-300 bg-white text-sm focus:outline-none focus:border-brand-purple-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="נקה חיפוש"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={[
                'px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
                activeCategory === null
                  ? 'bg-brand-purple-700 text-white border-brand-purple-700'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-brand-purple-400',
              ].join(' ')}
            >
              הכל
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory((prev) => (prev === c.id ? null : c.id))}
                className={[
                  'px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
                  activeCategory === c.id
                    ? 'bg-brand-purple-700 text-white border-brand-purple-700'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-brand-purple-400',
                ].join(' ')}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isSearching ? (
        <section>
          <SectionHeader icon={Compass} title={`תוצאות (${filtered.length})`} />
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="לא נמצאו תוצאות"
              message="נסה מילות חיפוש אחרות או בחר קטגוריה אחרת."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((g) => (
                <GuideCard key={g.id} guide={g} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* 1 — Featured Guides (content-first: largest visual priority) */}
          {featuredGuides.length > 0 && (
            <section>
              <SectionHeader icon={Sparkles} title="הדרכות מומלצות" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredGuides.map((g) => (
                  <GuideCard key={g.id} guide={g} />
                ))}
              </div>
            </section>
          )}

          {/* 2 — Featured Playlists */}
          {playlists.length > 0 && (
            <section>
              <SectionHeader icon={ListVideo} title="פלייליסטים מומלצים" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {playlists.map(({ playlist, count }) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} count={count} />
                ))}
              </div>
            </section>
          )}

          {/* 3 — Featured Creators (compact, secondary discovery layer) */}
          {creators.length > 0 && (
            <section>
              <SectionHeader icon={Users} title="יוצרים מובילים" href="/learn/creators" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {creators.map(({ creator, guides: g, playlists: p }) => (
                  <CreatorCard key={creator.id} creator={creator} guides={g} playlists={p} />
                ))}
              </div>
            </section>
          )}

          {/* 4 — Latest Guides */}
          <section>
            <SectionHeader icon={Compass} title="ההדרכות האחרונות" />
            {guides.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="אין עדיין הדרכות"
                message="תוכן חדש מתפרסם כל הזמן — בדוק שוב בקרוב."
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {guides.map((g) => (
                  <GuideCard key={g.id} guide={g} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
