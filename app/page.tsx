import Link from 'next/link';
import { ArrowLeft, Sparkles, Users, BookOpen, Compass } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getBrandSettings } from '@/lib/brand';
import {
  listContent,
  listFeaturedGuides,
  listPublishedGuides,
  listFeaturedCreators,
  listCreators,
  listFeaturedPlaylists,
  listPlaylists,
  getPlaylistItemCounts,
} from '@/lib/learn/db';
import { isPubliclyListed } from '@/lib/learn/access';
import { type HomepageSection } from '@/lib/learn/homepage';
import { getHomepageConfig } from '@/lib/learn/homepage-server';
import GuideCard from '@/components/learn/GuideCard';
import PlaylistCard from '@/components/learn/PlaylistCard';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { DOMAIN_BY_ID } from '@/lib/learn/domains';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'DigiTech HUB — השכלה פרקטית',
  description: 'קורסים, מדריכים ופלייבוקים מהיוצרים המובילים בישראל. התחילו ללמוד בחינם.',
};

const VALUE_PROPS = [
  { icon: Compass, title: 'למידה פרקטית', body: 'תוכן שמתורגם מיד לעשייה — בלי תאוריה מיותרת.' },
  { icon: Users, title: 'יוצרים מובילים', body: 'מומחים אמיתיים מהתעשייה, כל אחד בתחום שלו.' },
  { icon: Sparkles, title: 'מתחילים בחינם', body: 'גלו, צפו והתחילו ללמוד — הרשמה רק כשבא לכם להעמיק.' },
];

const FETCH_CAP = 24;

function take<T>(arr: T[], limit?: number | null): T[] {
  return arr.slice(0, limit && limit > 0 ? limit : arr.length);
}

export default async function HomePage() {
  const [auth, brand, sections, coursesRaw, featuredGuides, featuredCreators, featuredPlaylists] =
    await Promise.all([
      getCurrentUser(),
      getBrandSettings(),
      getHomepageConfig(),
      listContent('course'),
      listFeaturedGuides(FETCH_CAP),
      listFeaturedCreators(FETCH_CAP),
      listFeaturedPlaylists(FETCH_CAP),
    ]);

  const active = sections.filter((s) => s.enabled);
  const needs = (type: HomepageSection['type']) => active.some((s) => s.type === type);

  // Fallbacks only when the corresponding section is active and featured is empty.
  const courses = coursesRaw.filter(isPubliclyListed);
  const guides =
    needs('featured_guides') && featuredGuides.length === 0 ? await listPublishedGuides() : featuredGuides;
  const creators =
    needs('featured_creators') && featuredCreators.length === 0
      ? await listCreators({ activeOnly: true })
      : featuredCreators;
  const playlists =
    needs('featured_playlists') && featuredPlaylists.length === 0
      ? await listPlaylists({ publishedOnly: true })
      : featuredPlaylists;
  const playlistCounts =
    needs('featured_playlists') && playlists.length > 0
      ? await getPlaylistItemCounts(playlists.map((p) => p.id))
      : {};

  function renderSection(s: HomepageSection) {
    switch (s.type) {
      case 'hero':
        return (
          <section key={s.key} className="relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ backgroundImage: 'linear-gradient(140deg, #1A0F3D 0%, #2E1A5C 45%, #4A2E8F 100%)' }}
              aria-hidden
            />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center text-white">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-[12px] font-semibold bg-white/10 text-brand-purple-100 backdrop-blur-sm mb-6">
                <span className="w-1.5 h-1.5 rounded-pill" style={{ backgroundColor: 'var(--color-signal)' }} aria-hidden />
                DigiTech HUB · השכלה פרקטית
              </span>
              <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1] tracking-tight max-w-3xl mx-auto">
                {s.title || 'לומדים את מה שבאמת עובד'}
              </h1>
              {s.subtitle && (
                <p className="mt-5 text-lg sm:text-xl text-brand-purple-200 max-w-2xl mx-auto leading-relaxed">
                  {s.subtitle}
                </p>
              )}
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={s.cta_href || '/learn/courses'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-white text-brand-purple-800 text-base font-bold hover:bg-brand-purple-50 transition-colors"
                  style={{ boxShadow: 'var(--shadow-btn)' }}
                >
                  {s.cta_label || 'עיון בקורסים'}
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <Link
                  href="/learn/creators"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-white/25 text-white text-base font-semibold hover:bg-white/10 transition-colors"
                >
                  גלו יוצרים
                </Link>
              </div>
            </div>
          </section>
        );

      case 'value_props':
        return (
          <section key={s.key} className="max-w-6xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
            <div className="grid gap-4 sm:grid-cols-3">
              {VALUE_PROPS.map((v) => {
                const Icon = v.icon;
                return (
                  <div
                    key={v.title}
                    className="bg-white rounded-card border border-neutral-200 p-6"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    <span className="inline-flex w-11 h-11 rounded-pill bg-brand-purple-50 text-brand-purple-700 items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </span>
                    <h3 className="font-extrabold text-neutral-950 mb-1.5">{v.title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">{v.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );

      case 'featured_courses': {
        const items = take(courses, s.limit ?? 3);
        if (items.length === 0) return null;
        return (
          <Section key={s.key} title={s.title || 'קורסים נבחרים'} href={s.cta_href || '/learn/courses'} cta={s.cta_label || 'כל הקורסים'}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => {
                const domain = c.domain ? DOMAIN_BY_ID[c.domain] : null;
                return (
                  <Link
                    key={c.id}
                    href={`/learn/courses/${c.slug}`}
                    className="group flex flex-col bg-white rounded-card border border-neutral-200 overflow-hidden hover:border-brand-purple-700 transition-colors"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    <div
                      className="aspect-[16/9] relative"
                      style={
                        c.cover_url
                          ? { backgroundImage: `url(${c.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }
                      }
                    >
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-bold bg-white/90 text-neutral-700">
                        <BookOpen className="w-3 h-3" /> קורס
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      {domain && <span className="text-[11px] font-bold text-brand-purple-600 mb-1.5">{domain.label}</span>}
                      <h3 className="font-extrabold text-neutral-950 group-hover:text-brand-purple-700 transition-colors leading-snug line-clamp-2">
                        {c.title}
                      </h3>
                      {c.tagline && <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2">{c.tagline}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Section>
        );
      }

      case 'featured_guides': {
        const items = take(guides, s.limit ?? 6);
        if (items.length === 0) return null;
        return (
          <Section key={s.key} title={s.title || 'מדריכים אחרונים'} href={s.cta_href || '/learn/guides'} cta={s.cta_label || 'כל המדריכים'}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((g) => (
                <GuideCard key={g.id} guide={g} />
              ))}
            </div>
          </Section>
        );
      }

      case 'featured_creators': {
        const items = take(creators, s.limit ?? 8);
        if (items.length === 0) return null;
        return (
          <Section key={s.key} title={s.title || 'יוצרים מובילים'} href={s.cta_href || '/learn/creators'} cta={s.cta_label || 'כל היוצרים'}>
            <div className="flex flex-wrap gap-3">
              {items.map((cr) => (
                <Link
                  key={cr.id}
                  href={`/learn/creators/${cr.slug}`}
                  className="group flex items-center gap-3 bg-white rounded-pill border border-neutral-200 pe-5 ps-2 py-2 hover:border-brand-purple-400 transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <span className="w-10 h-10 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center font-extrabold overflow-hidden shrink-0">
                    {cr.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cr.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      cr.name.charAt(0)
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-neutral-900 group-hover:text-brand-purple-700 transition-colors truncate">
                      {cr.name}
                    </span>
                    {cr.role_title && <span className="block text-xs text-neutral-500 truncate">{cr.role_title}</span>}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        );
      }

      case 'featured_playlists': {
        const items = take(playlists, s.limit ?? 6);
        if (items.length === 0) return null;
        return (
          <Section key={s.key} title={s.title || 'פלייליסטים נבחרים'} href={s.cta_href || '/learn/playlists'} cta={s.cta_label || 'כל הפלייליסטים'}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <PlaylistCard key={p.id} playlist={p} count={playlistCounts[p.id] ?? 0} />
              ))}
            </div>
          </Section>
        );
      }

      case 'cta_band':
        return (
          <section key={s.key} className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
            <div
              className="rounded-panel text-white px-8 py-12 sm:py-14 text-center relative overflow-hidden"
              style={{ backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }}
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold">{s.title || 'מוכנים להעמיק?'}</h2>
              {s.subtitle && <p className="mt-3 text-brand-purple-200 max-w-xl mx-auto">{s.subtitle}</p>}
              <Link
                href={s.cta_href || '/pricing'}
                className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-pill bg-white text-brand-purple-800 text-base font-bold hover:bg-brand-purple-50 transition-colors"
                style={{ boxShadow: 'var(--shadow-btn)' }}
              >
                {s.cta_label || 'צפו במסלולים'}
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </section>
        );

      default:
        return null;
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)' }} className="min-h-screen">
      <MarketingHeader logoUrl={brand.logoUrl} loggedIn={!!auth} />
      {active.map(renderSection)}
      <MarketingFooter />
    </div>
  );
}

function Section({
  title,
  href,
  cta,
  children,
}: {
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-extrabold text-neutral-950">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple-700 hover:text-brand-purple-600 transition-colors">
          {cta}
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}
