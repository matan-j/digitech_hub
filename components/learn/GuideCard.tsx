import Link from 'next/link';
import { Clock } from 'lucide-react';
import GuideThumbnail from './GuideThumbnail';
import ShareButton from './ShareButton';
import { DOMAIN_BY_ID, domainBadgeClasses } from '@/lib/learn/domains';
import { CONTENT_KIND_SHORT } from '@/lib/learn/placeholder';
import type { ContentItem } from '@/lib/learn/types';

/** A guide as it appears in hub/creator/playlist grids. */
export default function GuideCard({ guide }: { guide: ContentItem }) {
  const domainMeta = guide.domain ? DOMAIN_BY_ID[guide.domain] : null;
  const kind = guide.content_kind ?? 'article';
  const creator = guide.creator;

  return (
    <div
      className="group relative flex flex-col h-full bg-white rounded-card border border-neutral-200 overflow-hidden hover:border-brand-purple-700 transition-colors"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="relative">
        <GuideThumbnail
          coverUrl={guide.cover_url}
          contentKind={guide.content_kind}
          contentUrl={guide.content_url}
          videoUrl={guide.video_url}
          className="aspect-[16/9]"
        />
        <span className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold bg-white/90 text-neutral-700 backdrop-blur-sm">
          {CONTENT_KIND_SHORT[kind]}
        </span>
        {domainMeta && (
          <span className={['absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold border', domainBadgeClasses(guide.domain)].join(' ')}>
            {domainMeta.label}
          </span>
        )}
        {/* Share sits above the stretched title link (z-20) so it stays clickable. */}
        <div className="absolute bottom-3 left-3 z-20">
          <ShareButton path={`/learn/guides/${guide.slug}`} title={guide.title} />
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-extrabold text-neutral-950 group-hover:text-brand-purple-700 transition-colors mb-1.5 leading-snug line-clamp-2">
          {/* Stretched primary link: makes the whole card open the guide,
              while the creator link below stays independently clickable. */}
          <Link href={`/learn/guides/${guide.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {guide.title}
          </Link>
        </h3>
        {guide.tagline && <p className="text-sm text-neutral-500 line-clamp-2">{guide.tagline}</p>}

        <div className="flex items-center gap-2 mt-auto pt-4 text-xs text-neutral-500">
          {creator ? (
            <Link
              href={`/learn/creators/${creator.slug}`}
              className="relative z-10 flex items-center gap-1.5 min-w-0 hover:text-brand-purple-700 transition-colors"
            >
              <span className="w-5 h-5 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                {creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  creator.name.charAt(0)
                )}
              </span>
              <span className="truncate font-medium text-neutral-600 group-hover:text-inherit">מאת {creator.name}</span>
            </Link>
          ) : (
            <span className="truncate font-medium text-neutral-600">מאת Digitech</span>
          )}
          {guide.duration_minutes ? (
            <span className="flex items-center gap-1 ms-auto shrink-0">
              <Clock className="w-3 h-3" />
              {guide.duration_minutes} ד׳
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
