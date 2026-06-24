'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/guides', label: 'הדרכות' },
  { href: '/admin/playlists', label: 'פלייליסטים' },
  { href: '/admin/creators', label: 'יוצרים' },
] as const;

/** Secondary tab bar for the Guides content cluster: Guides / Playlists / Creators. */
export default function ContentTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-neutral-200">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              active
                ? 'border-brand-purple-700 text-brand-purple-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-900',
            ].join(' ')}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
