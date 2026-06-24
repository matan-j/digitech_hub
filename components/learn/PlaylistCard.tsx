import Link from 'next/link';
import { ListVideo, PlaySquare } from 'lucide-react';
import { DOMAIN_BY_ID, domainBadgeClasses } from '@/lib/learn/domains';
import type { Playlist } from '@/lib/learn/types';

/** Playlist card: thumbnail, title, creator, guide count. */
export default function PlaylistCard({ playlist, count }: { playlist: Playlist; count: number }) {
  const domainMeta = playlist.domain ? DOMAIN_BY_ID[playlist.domain] : null;
  const cover = playlist.thumbnail_url;

  return (
    <div
      className="group relative flex flex-col h-full bg-white rounded-card border border-neutral-200 overflow-hidden hover:border-brand-purple-700 transition-colors"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="aspect-[16/9] relative"
        style={
          cover
            ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: 'linear-gradient(135deg, var(--color-brand-purple-200), var(--color-brand-purple-100) 70%, #FFFFFF)' }
        }
      >
        {!cover && (
          <div className="absolute inset-0 flex items-center justify-center text-brand-purple-400">
            <ListVideo className="w-10 h-10" strokeWidth={1.6} />
          </div>
        )}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-bold bg-black/55 text-white backdrop-blur-sm">
          <PlaySquare className="w-3 h-3" />
          {count} הדרכות
        </span>
        {domainMeta && (
          <span className={['absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold border', domainBadgeClasses(playlist.domain)].join(' ')}>
            {domainMeta.label}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-extrabold text-neutral-950 group-hover:text-brand-purple-700 transition-colors mb-1 leading-snug line-clamp-2">
          {/* Stretched primary link → opens the playlist; creator link stays clickable. */}
          <Link href={`/learn/playlists/${playlist.id}`} className="after:absolute after:inset-0 after:content-['']">
            {playlist.title}
          </Link>
        </h3>
        {playlist.description && (
          <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">{playlist.description}</p>
        )}

        <div className="mt-auto pt-3">
          {playlist.creator ? (
            <Link
              href={`/learn/creators/${playlist.creator.slug}`}
              className="relative z-10 inline-flex items-center gap-1.5 min-w-0 text-xs text-neutral-500 hover:text-brand-purple-700 transition-colors"
            >
              <span className="w-5 h-5 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                {playlist.creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playlist.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  playlist.creator.name.charAt(0)
                )}
              </span>
              <span className="truncate font-medium">מאת {playlist.creator.name}</span>
            </Link>
          ) : (
            <p className="text-xs text-neutral-500">מאת Digitech</p>
          )}
        </div>
      </div>
    </div>
  );
}
