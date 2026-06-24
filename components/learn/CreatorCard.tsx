import Link from 'next/link';
import { BookOpen, ListVideo, ArrowLeft } from 'lucide-react';
import SocialLinks from './SocialLinks';
import type { Creator } from '@/lib/learn/types';

/** Featured-creator card: avatar, name, bio, counts, social icons, CTA. */
export default function CreatorCard({
  creator,
  guides,
  playlists,
}: {
  creator: Creator;
  guides: number;
  playlists: number;
}) {
  return (
    <div
      className="flex flex-col h-full bg-white rounded-card border border-neutral-200 p-5 hover:border-brand-purple-700 transition-colors"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-xl font-extrabold shrink-0 overflow-hidden">
          {creator.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            creator.name.charAt(0)
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-extrabold text-neutral-950 leading-tight truncate">{creator.name}</h3>
          {creator.role_title && (
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{creator.role_title}</p>
          )}
        </div>
      </div>

      {creator.bio && (
        <p className="text-sm text-neutral-600 mt-3 line-clamp-2 leading-relaxed">{creator.bio}</p>
      )}

      <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-purple-600" />
          {guides} הדרכות
        </span>
        <span className="flex items-center gap-1.5">
          <ListVideo className="w-3.5 h-3.5 text-brand-purple-600" />
          {playlists} פלייליסטים
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-neutral-100">
        <SocialLinks socials={creator} size="sm" />
        <Link
          href={`/learn/creators/${creator.slug}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple-700 hover:text-brand-purple-600 shrink-0"
        >
          לפרופיל
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
