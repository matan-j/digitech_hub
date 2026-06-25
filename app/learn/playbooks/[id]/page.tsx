import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';
import { getPlaybook, getPlaybookBySlug } from '@/lib/learn/db';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { decideAccess, gateCtaLabel, type GateReason } from '@/lib/learn/access';
import AccessActionButton from '@/components/learn/AccessActionButton';
import { DOMAIN_BY_ID, domainBadgeClasses, domainDotClasses } from '@/lib/learn/domains';
import { youtubeIdFromUrl, youtubeEmbedUrl } from '@/lib/learn/youtube';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lookup(idOrSlug: string) {
  // Prefer slug lookup for non-UUID strings (pretty URLs); fall back to UUID.
  if (UUID_RE.test(idOrSlug)) return getPlaybook(idOrSlug);
  return (await getPlaybookBySlug(idOrSlug)) ?? (await getPlaybook(idOrSlug));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await lookup(id);
  return { title: p ? `${p.title} — DigiTech HUB` : 'פלייבוק לא נמצא' };
}

export default async function PlaybookViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playbook = await lookup(id);
  if (!playbook) notFound();

  // Non-admins only see published. RLS already enforces this for selects, but
  // an admin viewing a draft still works — they get a banner via the badge.
  const auth = await getCurrentUser();
  const isAdmin = auth?.profile.role === 'admin';
  if (!isAdmin && playbook.status !== 'published') notFound();

  // Public-first: never redirect. Decide full / preview / locked from the
  // access model (admins always get full via hasPremiumAccess).
  const decision = decideAccess(playbook, {
    loggedIn: !!auth,
    hasPremium: !!auth && hasPremiumAccess(auth.profile),
  });
  const showFull = decision.state === 'full';
  const slugOrId = playbook.slug ?? playbook.id;

  const ytId = youtubeIdFromUrl(playbook.video_url);
  const domainMeta = playbook.domain ? DOMAIN_BY_ID[playbook.domain] : null;
  const cover = playbook.cover_url;
  const hasHtml = !!playbook.html_content && playbook.html_content.trim().length > 0;
  // Auto-generated playbooks (no video, no cover, no description, no slug) — keep
  // the legacy viewer (raw HTML iframe full-bleed) so they still render correctly.
  const isLegacyAutoGen = !ytId && !cover && !playbook.tagline && !playbook.description && !playbook.domain;

  if (isLegacyAutoGen && hasHtml && showFull) {
    return (
      <div className="min-h-screen bg-white">
        <iframe
          title={playbook.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          srcDoc={playbook.html_content}
          className="w-full h-screen border-0"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <article className="px-6 lg:px-10 py-8 max-w-3xl mx-auto">
        <Link href="/learn/playbooks" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6">
          <ArrowRight className="w-3.5 h-3.5" />
          חזרה לפלייבוקים
        </Link>

        <header className="mb-8">
          {ytId ? (
            <div className="aspect-video rounded-2xl overflow-hidden mb-6 border border-neutral-200 bg-black">
              <iframe
                src={youtubeEmbedUrl(ytId)}
                title={playbook.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : cover ? (
            <div className="aspect-[16/7] rounded-2xl overflow-hidden mb-6 border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {domainMeta && (
              <span className={['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-bold border', domainBadgeClasses(playbook.domain)].join(' ')}>
                <span className={['w-1.5 h-1.5 rounded-pill', domainDotClasses(playbook.domain)].join(' ')} aria-hidden />
                {domainMeta.label}
              </span>
            )}
            {isAdmin && playbook.status !== 'published' && (
              <span className="inline-block px-2.5 py-1 rounded-pill text-[11px] font-bold bg-amber-100 text-amber-900">
                טיוטה (לא פורסם)
              </span>
            )}
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold text-neutral-950 mb-3 leading-tight">{playbook.title}</h1>
          {playbook.tagline && <p className="text-lg text-neutral-600 leading-relaxed">{playbook.tagline}</p>}
          {playbook.description && (
            <p className="text-sm text-neutral-700 leading-relaxed mt-4 whitespace-pre-line">{playbook.description}</p>
          )}
          {playbook.audience && (
            <p className="text-xs text-neutral-500 mt-3 inline-block bg-neutral-100 rounded-pill px-2.5 py-1 font-semibold">
              קהל יעד: {playbook.audience}
            </p>
          )}
        </header>

        {!showFull && <PlaybookGate reason={decision.reason} slugOrId={slugOrId} />}
      </article>

      {showFull && hasHtml && (
        <iframe
          title={playbook.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          srcDoc={playbook.html_content}
          className="w-full min-h-[80vh] border-0 border-t border-neutral-200"
        />
      )}
    </div>
  );
}

/** Access gate for login/subscription-gated playbooks. */
function PlaybookGate({ reason, slugOrId }: { reason: GateReason; slugOrId: string }) {
  const returnTo = `/learn/playbooks/${slugOrId}`;
  // Playbooks are not priced in content_items (V1), so a 'purchase' gate falls
  // back to the subscription path; in practice the 018 backfill maps premium
  // playbooks to subscription_required.
  const kind = reason === 'login' ? 'login' : 'subscribe';
  return (
    <div
      className="rounded-2xl border border-neutral-200 bg-white p-8 text-center mt-2"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="w-12 h-12 mx-auto mb-4 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
        <Lock className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-extrabold text-neutral-950 mb-1.5">הפלייבוק המלא דורש גישה</h2>
      <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-6">
        קבלו גישה מלאה לפלייבוק הזה ולכל הספרייה.
      </p>
      <AccessActionButton
        kind={kind}
        slug={slugOrId}
        returnTo={returnTo}
        label={gateCtaLabel(reason)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-bold transition-colors disabled:opacity-70"
      />
    </div>
  );
}
