import Link from 'next/link';

const NAV = [
  { label: 'קורסים', href: '/learn/courses' },
  { label: 'מדריכים', href: '/learn/guides' },
  { label: 'יוצרים', href: '/learn/creators' },
  { label: 'פלייליסטים', href: '/learn/playlists' },
  { label: 'מחירים', href: '/pricing' },
];

/**
 * Public marketing header for `/` and `/pricing`. Server component — takes the
 * brand logo + session flag as props (no client state). The Learning Hub itself
 * uses its own right-side NavSidebar; this header is for the open marketing
 * surface only, so the two never duplicate chrome.
 */
export default function MarketingHeader({
  logoUrl,
  loggedIn,
}: {
  logoUrl: string | null;
  loggedIn: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="DigiTech" className="w-9 h-9 rounded-[10px] object-cover" />
          ) : (
            <span className="brand-badge" style={{ ['--s' as never]: '36px' }} aria-hidden>
              <span className="swoosh" />
            </span>
          )}
          <span className="font-extrabold text-neutral-950 text-[17px] tracking-tight">
            DigiTech
            <span className="text-brand-teal align-top text-[10px] font-extrabold tracking-wider mr-1">HUB</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded-pill text-sm font-medium text-neutral-600 hover:text-brand-purple-700 hover:bg-brand-purple-50 transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ms-auto md:ms-0">
          {loggedIn ? (
            <Link
              href="/learn"
              className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-bold transition-colors"
              style={{ boxShadow: 'var(--shadow-btn)' }}
            >
              לאזור הלמידה
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors"
              >
                התחברות
              </Link>
              <Link
                href="/learn"
                className="px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-bold transition-colors"
                style={{ boxShadow: 'var(--shadow-btn)' }}
              >
                כניסה חופשית
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
