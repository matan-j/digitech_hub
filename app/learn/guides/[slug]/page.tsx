import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock, FileText, ExternalLink, Download, Eye, Lock } from 'lucide-react';
import {
  getGuideWithCreator,
  recordGuideView,
  getPlaylistsContainingGuide,
  listGuidesByCreator,
} from '@/lib/learn/db';
import { getCurrentUser, getMyCreator, hasPremiumAccess } from '@/lib/auth';
import GuideBlocks from '@/components/learn/GuideBlocks';
import ContentTableOfContents from '@/components/learn/ContentTableOfContents';
import { toRichBlocks, extractToc } from '@/lib/learn/rich-content';
import VimeoPlayer from '@/components/learn/VimeoPlayer';
import GuideCard from '@/components/learn/GuideCard';
import SocialLinks from '@/components/learn/SocialLinks';
import { DOMAIN_BY_ID, domainBadgeClasses, domainDotClasses } from '@/lib/learn/domains';
import { youtubeIdFromUrl, youtubeEmbedUrl } from '@/lib/learn/youtube';
import { parseVimeoInput } from '@/lib/learn/vimeo';
import { contentKindLabel } from '@/lib/learn/placeholder';
import { decideAccess, gateCtaLabel, formatPrice, type GateReason } from '@/lib/learn/access';
import AccessActionButton from '@/components/learn/AccessActionButton';
import ShareButton from '@/components/learn/ShareButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGuideWithCreator(slug);
  if (!g) return { title: 'מדריך לא נמצא' };
  return {
    title: g.seo_title || `${g.title} — Digitech Learning Hub`,
    description: g.seo_description || g.tagline || undefined,
    openGraph: g.og_image_url ? { images: [g.og_image_url] } : undefined,
  };
}

export default async function GuideReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuideWithCreator(slug);
  if (!guide) notFound();

  const auth = await getCurrentUser();

  // Draft visibility: only admin or the owning creator may preview.
  const isPublished = guide.status === 'published';
  if (!isPublished) {
    const isAdmin = auth?.profile.role === 'admin';
    const myCreator = auth ? await getMyCreator() : null;
    const ownsIt = !!myCreator && myCreator.id === guide.creator_id;
    if (!isAdmin && !ownsIt) notFound();
  }

  // Public-first: never redirect on a published guide. Decide whether the
  // viewer sees the full body, a preview, or just the metadata + a gate CTA.
  // (For currently-premium guides the row is RLS-hidden until migration 022,
  // so this path activates once the access-model migrations are applied.)
  const decision = decideAccess(guide, {
    loggedIn: !!auth,
    hasPremium: !!auth && hasPremiumAccess(auth.profile),
  });
  const showFull = decision.state === 'full';

  // Record a view (best-effort, published only).
  if (isPublished) await recordGuideView(guide.id, auth?.userId ?? null);

  const [playlists, creatorGuides] = await Promise.all([
    getPlaylistsContainingGuide(guide.id),
    guide.creator_id ? listGuidesByCreator(guide.creator_id, true) : Promise.resolve([]),
  ]);
  const related = creatorGuides.filter((g) => g.id !== guide.id).slice(0, 3);

  const kind = guide.content_kind ?? 'article';
  const domainMeta = guide.domain ? DOMAIN_BY_ID[guide.domain] : null;
  const ytId = youtubeIdFromUrl(guide.content_url) ?? youtubeIdFromUrl(guide.video_url);
  const vimeo = guide.content_url ? parseVimeoInput(guide.content_url) : null;

  // "במדריך הזה" table of contents — shown when the body has 3+ H2 sections.
  const toc = showFull ? extractToc(toRichBlocks(guide.body)) : [];
  const hasToc = toc.length >= 3;

  return (
    <article className={['px-4 sm:px-6 lg:px-10 py-8 mx-auto', hasToc ? 'max-w-5xl' : 'max-w-3xl'].join(' ')}>
      <Link href="/learn/guides" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה למדריכים
      </Link>

      {!isPublished && (
        <div className="mb-6 flex items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Eye className="w-4 h-4" />
          תצוגה מקדימה — המדריך עדיין בטיוטה ואינו גלוי לציבור.
        </div>
      )}

      <div className={hasToc ? 'lg:grid lg:grid-cols-[1fr_14rem] lg:gap-10 lg:items-start' : ''}>
        <div className="min-w-0">
        {hasToc && (
          <div className="lg:hidden mb-6">
            <ContentTableOfContents entries={toc} variant="inline" />
          </div>
        )}
      <header className="mb-8">
        {/* Hero — player for video kinds, cover otherwise */}
        {kind === 'youtube' && ytId ? (
          <div className="aspect-video rounded-2xl overflow-hidden mb-6 border border-neutral-200 bg-black">
            <iframe
              src={youtubeEmbedUrl(ytId)}
              title={guide.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : kind === 'vimeo' && vimeo ? (
          <div className="mb-6">
            <VimeoPlayer vimeoId={vimeo.id} title={guide.title} />
          </div>
        ) : guide.cover_url ? (
          <div className="aspect-[16/7] rounded-2xl overflow-hidden mb-6 border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={guide.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-[11px] font-bold bg-brand-purple-50 text-brand-purple-700">
            {contentKindLabel(guide.content_kind)}
          </span>
          {domainMeta && (
            <span className={['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-bold border', domainBadgeClasses(guide.domain)].join(' ')}>
              <span className={['w-1.5 h-1.5 rounded-pill', domainDotClasses(guide.domain)].join(' ')} aria-hidden />
              {domainMeta.label}
            </span>
          )}
          {(guide.categories ?? []).map((c) => (
            <span key={c.id} className="inline-block px-2.5 py-1 rounded-pill text-[11px] font-medium bg-neutral-100 text-neutral-700">
              {c.name}
            </span>
          ))}
          {guide.duration_minutes ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
              <Clock className="w-3 h-3" />
              {guide.duration_minutes} דקות
            </span>
          ) : null}
          <span className="ms-auto">
            <ShareButton path={`/learn/guides/${slug}`} title={guide.title} variant="inline" />
          </span>
        </div>

        <h1 className="text-3xl lg:text-4xl font-extrabold text-neutral-950 mb-3 leading-tight">{guide.title}</h1>
        {guide.tagline && <p className="text-lg text-neutral-600 leading-relaxed">{guide.tagline}</p>}
      </header>

      {/* Creator card */}
      {guide.creator && (
        <div
          className="flex items-center gap-3 mb-8 p-4 rounded-card border border-neutral-200 bg-white"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <Link href={`/learn/creators/${guide.creator.slug}`} className="flex items-center gap-3 min-w-0 flex-1 group">
            <span className="w-11 h-11 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center font-extrabold overflow-hidden shrink-0">
              {guide.creator.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={guide.creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                guide.creator.name.charAt(0)
              )}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-neutral-900 truncate group-hover:text-brand-purple-700 transition-colors">{guide.creator.name}</p>
              {guide.creator.role_title && <p className="text-xs text-neutral-500 truncate">{guide.creator.role_title}</p>}
            </div>
          </Link>
          <SocialLinks socials={guide.creator} size="sm" />
        </div>
      )}

      {/* Gated guides show a public intro + access CTA instead of the body. */}
      {decision.state !== 'full' && (
        <GuideGate
          reason={decision.reason}
          slug={slug}
          priceLabel={formatPrice(guide.price_amount, guide.price_currency)}
        />
      )}

      {/* Main content by kind */}
      {showFull && kind === 'article' && <GuideBlocks blocks={guide.body} />}

      {showFull && kind === 'pdf' && guide.content_url && (
        <div className="space-y-4">
          <div className="aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50">
            <iframe src={guide.content_url} title={guide.title} className="w-full h-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={guide.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
            >
              <FileText className="w-4 h-4" /> פתח את ה-PDF
            </a>
            <a
              href={guide.content_url}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" /> הורד
            </a>
          </div>
        </div>
      )}

      {showFull && kind === 'link' && guide.content_url && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="w-12 h-12 mx-auto mb-3 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
            <ExternalLink className="w-6 h-6" />
          </div>
          <p className="text-sm text-neutral-600 mb-4 break-all" dir="ltr">{guide.content_url}</p>
          <a
            href={guide.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> פתח קישור חיצוני
          </a>
        </div>
      )}

      {/* When the body has extra notes alongside a video/pdf/link */}
      {showFull && kind !== 'article' && guide.body.length > 0 && (
        <div className="mt-8">
          <GuideBlocks blocks={guide.body} />
        </div>
      )}

      {/* Playlist context */}
      {playlists.length > 0 && (
        <div className="mt-10 pt-6 border-t border-neutral-200">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">חלק מהפלייליסטים</p>
          <div className="flex flex-wrap gap-2">
            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/learn/playlists/${p.id}`}
                className="inline-flex items-center px-3 py-1.5 rounded-pill text-sm font-medium bg-brand-purple-50 text-brand-purple-700 hover:bg-brand-purple-100 transition-colors"
              >
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Related guides */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-extrabold text-neutral-950 mb-4">עוד מאותו יוצר</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </div>
      )}
        </div>
        {hasToc && (
          <aside className="hidden lg:block w-56 shrink-0">
            <ContentTableOfContents entries={toc} variant="sidebar" />
          </aside>
        )}
      </div>
    </article>
  );
}

/** Public intro gate shown for login/purchase/subscription-gated guides. */
function GuideGate({ reason, slug, priceLabel }: { reason: GateReason; slug: string; priceLabel: string | null }) {
  const returnTo = `/learn/guides/${slug}`;
  const kind = reason === 'login' ? 'login' : reason === 'subscription' ? 'subscribe' : 'purchase';
  const label =
    reason === 'purchase' && priceLabel ? `${gateCtaLabel(reason)} · ${priceLabel}` : gateCtaLabel(reason);
  const btnCls =
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-bold transition-colors disabled:opacity-70';
  return (
    <div
      className="rounded-2xl border border-neutral-200 bg-white p-8 text-center"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="w-12 h-12 mx-auto mb-4 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
        <Lock className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-extrabold text-neutral-950 mb-1.5">המשך הקריאה דורש גישה</h2>
      <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-6">
        שמרו את ההתקדמות שלכם וקבלו גישה מלאה לתוכן הזה ולעוד.
      </p>
      <AccessActionButton
        kind={kind}
        slug={slug}
        contentType="guide"
        returnTo={returnTo}
        label={label}
        className={btnCls}
      />
    </div>
  );
}
