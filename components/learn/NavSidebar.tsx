'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, BookOpen, Compass, BookText, ShieldCheck, LogOut,
} from 'lucide-react';
import type { AuthState } from '@/lib/auth';
import type { BrandSettings, SocialKey } from '@/lib/brand';
import {
  InstagramIcon, FacebookIcon, LinkedinIcon, YoutubeIcon,
  TiktokIcon, XIcon, WebsiteIcon,
} from '@/components/icons/social';
import LogoutButton from '@/components/auth/LogoutButton';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOP: NavItem[] = [
  { label: 'דאשבורד', href: '/learn', icon: Home },
  { label: 'קורסים', href: '/learn/courses', icon: BookOpen },
  { label: 'מדריכים', href: '/learn/guides', icon: Compass },
  { label: 'פלייבוקים', href: '/learn/playbooks', icon: BookText },
];

const SOCIAL_ICONS: Record<SocialKey, React.ComponentType<{ className?: string }>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  x: XIcon,
  website: WebsiteIcon,
};

const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  website: 'אתר חיצוני',
};

const SOCIAL_ORDER: SocialKey[] = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'x', 'website'];

export default function NavSidebar({
  auth,
  brand,
}: {
  auth: AuthState | null;
  brand: BrandSettings;
}) {
  const pathname = usePathname();
  const { logoUrl, social } = brand;
  const activeSocial = SOCIAL_ORDER.filter((k) => Boolean(social[k]));
  const hasAccess = auth?.profile.role === 'admin' || auth?.profile.subscription_status === 'active';
  const roleLabel = !auth
    ? null
    : auth.profile.role === 'admin'
      ? 'אדמין'
      : auth.profile.subscription_status === 'active'
        ? 'מנוי פעיל'
        : 'אורח';

  return (
    <aside
      className="
        fixed right-0 top-0 h-full w-64 z-40
        bg-white border-l border-brand-purple-200
        flex flex-col
        hidden lg:flex
      "
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-purple-200">
        <Link href="/learn" className="flex items-center gap-2.5 group">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Digitech" className="h-9 w-9 rounded-pill object-cover bg-white" />
          ) : (
            <div className="w-9 h-9 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white font-bold text-sm">
              D
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-extrabold text-neutral-950 leading-tight">Digitech</span>
            <span className="text-[11px] text-neutral-500 leading-tight">Learning Hub</span>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="px-3 py-4 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {TOP.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/learn' && pathname.startsWith(item.href)) ||
              (item.href === '/learn' && pathname === '/learn');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    'group relative flex items-center gap-3 px-3.5 py-2.5',
                    'rounded-pill text-sm font-medium transition-colors',
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
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}

          {auth?.profile.role === 'admin' && (
            <li className="pt-4 mt-4 border-t border-brand-purple-200">
              <Link
                href="/admin"
                className={[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-brand-purple-100 text-brand-purple-900'
                    : 'text-neutral-600 hover:bg-brand-purple-50 hover:text-neutral-950',
                ].join(' ')}
              >
                <ShieldCheck
                  className={[
                    'w-[18px] h-[18px] shrink-0',
                    pathname.startsWith('/admin') ? 'text-brand-purple-700' : 'text-neutral-500 group-hover:text-brand-purple-700',
                  ].join(' ')}
                />
                <span>ניהול תוכן</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* Social icon row */}
      {activeSocial.length > 0 && (
        <div className="px-5 py-3 border-t border-brand-purple-200 flex items-center justify-center gap-1.5">
          {activeSocial.map((k) => {
            const Icon = SOCIAL_ICONS[k];
            return (
              <a
                key={k}
                href={social[k]!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SOCIAL_LABELS[k]}
                title={SOCIAL_LABELS[k]}
                className="w-8 h-8 rounded-pill flex items-center justify-center text-neutral-500 hover:text-brand-purple-700 hover:bg-brand-purple-50 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            );
          })}
        </div>
      )}

      {/* Bottom user / auth block */}
      <div className="px-3 py-4 border-t border-brand-purple-200 space-y-2">
        {auth ? (
          <>
            <Link
              href="/account"
              className="flex items-center gap-3 px-3 py-2.5 rounded-card bg-brand-purple-50 hover:bg-brand-purple-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(auth.profile.full_name ?? auth.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-neutral-950 truncate" dir="ltr">
                  {auth.email}
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1">
                  {roleLabel}
                  {hasAccess && (
                    <span className="inline-block w-1 h-1 rounded-full bg-brand-accent" aria-hidden />
                  )}
                </span>
              </div>
            </Link>
            <LogoutButton className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-pill border border-brand-purple-200 hover:border-brand-purple-400 text-neutral-600 hover:text-neutral-950 text-xs font-medium transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              התנתק
            </LogoutButton>
          </>
        ) : (
          <>
            <Link
              href="/upgrade"
              className="block w-full text-center px-3 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
            >
              הירשם למועדון
            </Link>
            <Link
              href="/login"
              className="block w-full text-center px-3 py-2 rounded-pill border border-brand-purple-200 hover:border-brand-purple-400 text-neutral-700 hover:text-neutral-950 text-sm font-medium transition-colors"
            >
              התחבר
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
