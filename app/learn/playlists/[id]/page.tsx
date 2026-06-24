import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ListVideo, Clock } from 'lucide-react';
import {
  getPlaylistById,
  getPlaylistGuides,
  listFeaturedGuides,
} from '@/lib/learn/db';
import GuideCard from '@/components/learn/GuideCard';
import GuideThumbnail from '@/components/learn/GuideThumbnail';
import EmptyState from '@/components/learn/EmptyState';
import { DOMAIN_BY_ID, domainBadgeClasses } from '@/lib/learn/domains';
import { contentKindLabel } from '@/lib/learn/placeholder';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPlaylistById(id);
  if (!p) return { title: 'פלייליסט לא נמצא' };
  return {
    title: p.seo_title || `${p.title} — Digitech Learning Hub`,
    description: p.seo_description || p.description || undefined,
    openGraph: p.og_image_url ? { images: [p.og_image_url] } : undefined,
  };
}

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlist = await getPlaylistById(id);
  if (!playlist) notFound();

  const guides = await getPlaylistGuides(id);
  const totalMinutes = guides.reduce((sum, g) => sum + (g.duration_minutes ?? 0), 0);
  const domainMeta = playlist.domain ? DOMAIN_BY_ID[playlist.domain] : null;

  // Recommended = featured guides not already in this playlist.
  const featured = await listFeaturedGuides(6);
  const inPlaylist = new Set(guides.map((g) => g.id));
  const recommended = featured.filter((g) => !inPlaylist.has(g.id)).slice(0, 3);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-5xl mx-auto">
      <Link href="/learn/guides" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה להדרכות
      </Link>

      {/* Hero */}
      <div className="rounded-card overflow-hidden border border-neutral-200 bg-white mb-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="grid sm:grid-cols-[2fr_3fr]">
          <div
            className="aspect-[16/9] sm:aspect-auto relative min-h-[160px]"
            style={
              playlist.thumbnail_url
                ? { backgroundImage: `url(${playlist.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundImage: 'linear-gradient(135deg, #2E1A5C, #4B2E83)' }
            }
          >
            {!playlist.thumbnail_url && (
              <div className="absolute inset-0 flex items-center justify-center text-white/40">
                <ListVideo className="w-12 h-12" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">פלייליסט</span>
              {domainMeta && (
                <span className={['inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold border', domainBadgeClasses(playlist.domain)].join(' ')}>
                  {domainMeta.label}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 mb-2">{playlist.title}</h1>
            {playlist.description && <p className="text-sm text-neutral-600 leading-relaxed">{playlist.description}</p>}

            <div className="flex flex-wrap items-center gap-4 mt-auto pt-4 text-xs text-neutral-500">
              {playlist.creator && (
                <Link href={`/learn/creators/${playlist.creator.slug}`} className="font-semibold text-neutral-700 hover:text-brand-purple-700">
                  {playlist.creator.name}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <ListVideo className="w-3.5 h-3.5" /> {guides.length} הדרכות
              </span>
              {totalMinutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {totalMinutes} דקות
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ordered guide list */}
      {guides.length === 0 ? (
        <EmptyState icon={ListVideo} title="אין עדיין הדרכות בפלייליסט" />
      ) : (
        <ol className="space-y-3">
          {guides.map((g, i) => (
            <li key={g.id}>
              <Link
                href={`/learn/guides/${g.slug}`}
                className="group flex items-center gap-4 p-3 rounded-card border border-neutral-200 bg-white hover:border-brand-purple-700 transition-colors"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <span className="text-sm font-extrabold text-neutral-400 w-6 text-center shrink-0" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {i + 1}
                </span>
                <GuideThumbnail
                  coverUrl={g.cover_url}
                  contentKind={g.content_kind}
                  contentUrl={g.content_url}
                  videoUrl={g.video_url}
                  className="w-28 aspect-[16/9] rounded-lg shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-neutral-900 group-hover:text-brand-purple-700 transition-colors truncate">{g.title}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                    <span>{contentKindLabel(g.content_kind)}</span>
                    {g.duration_minutes ? <span>· {g.duration_minutes} ד׳</span> : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-extrabold text-neutral-950 mb-4">מומלצים עבורך</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommended.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
