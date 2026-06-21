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
} from '@/lib/learn/db';
import { isPubliclyListed } from '@/lib/learn/access';
import GuideCard from '@/components/learn/GuideCard';
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

export default async function HomePage() {
  const [auth, brand, coursesRaw, featuredGuides, featuredCreators] = await Promise.all([
    getCurrentUser(),
    getBrandSettings(),
    listContent('course'),
    listFeaturedGuides(6),
    listFeaturedCreators(8),
  ]);

  const courses = coursesRaw.filter(isPubliclyListed).slice(0, 3);
  const guides = (featuredGuides.length > 0 ? featuredGuides : await listPublishedGuides()).slice(0, 6);
  const creators = (featuredCreators.length > 0 ? featuredCreators : await listCreators({ activeOnly: true })).slice(0, 8);

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)' }} className="min-h-screen">
      <MarketingHeader logoUrl={brand.logoUrl} loggedIn={!!auth} />

      {/* Hero */}
      <section className="relative overflow-hidden">
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
            לומדים את מה שבאמת עובד
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-brand-purple-200 max-w-2xl mx-auto leading-relaxed">
            קורסים, מדריכים ופלייבוקים מהיוצרים המובילים בישראל. גלו, צפו והתחילו ללמוד — בלי הרשמה, בלי חסמים.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/learn/courses"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-white text-brand-purple-800 text-base font-bold hover:bg-brand-purple-50 transition-colors"
              style={{ boxShadow: 'var(--shadow-btn)' }}
            >
              עיון בקורסים
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

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
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

      {/* Featured courses */}
      {courses.length > 0 && (
        <Section title="קורסים נבחרים" href="/learn/courses" cta="כל הקורסים">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
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
                    {domain && (
                      <span className="text-[11px] font-bold text-brand-purple-600 mb-1.5">{domain.label}</span>
                    )}
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
      )}

      {/* Featured guides — guides stay visually primary */}
      {guides.length > 0 && (
        <Section title="מדריכים אחרונים" href="/learn/guides" cta="כל המדריכים">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </Section>
      )}

      {/* Featured creators — secondary */}
      {creators.length > 0 && (
        <Section title="יוצרים מובילים" href="/learn/creators" cta="כל היוצרים">
          <div className="flex flex-wrap gap-3">
            {creators.map((cr) => (
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
      )}

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
        <div
          className="rounded-panel text-white px-8 py-12 sm:py-14 text-center relative overflow-hidden"
          style={{ backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }}
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold">מוכנים להעמיק?</h2>
          <p className="mt-3 text-brand-purple-200 max-w-xl mx-auto">
            הצטרפו למועדון לגישה מלאה לקורסים, מעקב התקדמות וחומרי עבודה להורדה.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-pill bg-white text-brand-purple-800 text-base font-bold hover:bg-brand-purple-50 transition-colors"
            style={{ boxShadow: 'var(--shadow-btn)' }}
          >
            צפו במסלולים
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>

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
