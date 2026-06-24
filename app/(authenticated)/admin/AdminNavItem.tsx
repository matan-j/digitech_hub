'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Compass, BookText, Users, Palette, Tags, Sparkles, UserSearch, Home, ShoppingBag } from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'דאשבורד', Icon: LayoutDashboard, exact: true },
  { href: '/admin/homepage', label: 'עמוד הבית', Icon: Home, exact: false },
  { href: '/admin/courses', label: 'קורסים', Icon: BookOpen, exact: false },
  { href: '/admin/guides', label: 'הדרכות', Icon: Compass, exact: false },
  { href: '/admin/playbooks', label: 'פלייבוקים', Icon: BookText, exact: false },
  { href: '/admin/taxonomy', label: 'תחומים וקטגוריות', Icon: Tags, exact: false },
  { href: '/admin/users', label: 'משתמשים', Icon: Users, exact: false },
  { href: '/admin/purchases', label: 'רכישות', Icon: ShoppingBag, exact: false },
  { href: '/admin/leads', label: 'לידים ולומדים', Icon: UserSearch, exact: false },
  { href: '/admin/creators', label: 'יוצרים', Icon: Sparkles, exact: false },
  { href: '/admin/brand', label: 'מותג', Icon: Palette, exact: false },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {NAV.map(({ href, label, Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
        return (
          <li key={href}>
            <Link
              href={href}
              className={[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-purple-100 text-brand-purple-900'
                  : 'text-neutral-600 hover:bg-brand-purple-50 hover:text-neutral-950',
              ].join(' ')}
            >
              <Icon
                className={[
                  'w-[18px] h-[18px] shrink-0',
                  isActive ? 'text-brand-purple-700' : 'text-neutral-500 group-hover:text-brand-purple-700',
                ].join(' ')}
              />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
