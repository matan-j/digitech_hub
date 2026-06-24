'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User, BookOpen, ListVideo } from 'lucide-react';

const ITEMS = [
  { href: '/learn/creator', label: 'סקירה', icon: LayoutDashboard, exact: true },
  { href: '/learn/creator/guides', label: 'ההדרכות שלי', icon: BookOpen, exact: false },
  { href: '/learn/creator/playlists', label: 'הפלייליסטים שלי', icon: ListVideo, exact: false },
  { href: '/learn/creator/profile', label: 'הפרופיל שלי', icon: User, exact: false },
] as const;

export default function CreatorDashboardNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-8">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={[
              'inline-flex items-center gap-2 px-3.5 py-2 rounded-pill text-sm font-medium transition-colors',
              active
                ? 'bg-brand-purple-700 text-white'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:border-brand-purple-400',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
