'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, BookOpen, Compass, BookText, Users, ShieldCheck, LogOut, LayoutDashboard,
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
  { label: 'עמוד הבית', href: '/learn', icon: Home },
  { label: 'קורסים', href: '/learn/courses', icon: BookOpen },
  { label: 'הדרכות', href: '/learn/guides', icon: Compass },
  { label: 'פלייבוקים', href: '/learn/playbooks', icon: BookText },
  { label: 'יוצרים', href: '/learn/creators', icon: Users },
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
      : auth.profile.role === 'creator'
        ? 'יוצר'
        : auth.profile.subscription_status === 'active'
          ? 'מנוי פעיל'
          : 'אורח';

  return (
    <aside
      className="
        fixed right-0 top-0 h-full w-64 z-40
        bg-brand-purple-900 text-white
        flex flex-col
        hidden lg:flex
      "
      style={{
        backgroundImage:
          'linear-gradient(180deg, #1A0F3D 0%, #2E1A5C 60%, #2A1654 100%)',
      }}
    >
      {/* Brand lockup */}
      <div className="px-5 py-6 border-b border-white/8">
        <Link href="/learn" className="flex items-center gap-3 group">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="DigiTech"
              className="w-10 h-10 rounded-[11px] object-cover bg-white/8 p-1"
            />
          ) : (
            <span
              className="brand-badge"
              style={{ ['--s' as never]: '40px' }}
              aria-hidden
            >
              <span className="swoosh" />
            </span>
          )}
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-extrabold text-white text-[17px] tracking-tight">
              DigiTech
              <span className="text-brand-teal-bright font-extrabold text-[10px] tracking-wider align-top mr-1">HUB</span>
            </span>
            <span className="text-[11px] text-white/55 mt-0.5">השכלה פרקטית</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
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
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'group relative flex items-center gap-3 px-3.5 py-2.5',
                    'rounded-pill text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/12 text-white'
                      : 'text-white/65 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  <Icon
                    className={[
                      'w-[18px] h-[18px] shrink-0 transition-colors',
                      isActive ? 'text-brand-teal-bright' : 'text-white/55 group-hover:text-white/85',
                    ].join(' ')}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="ms-auto w-1.5 h-1.5 rounded-full bg-signal"
                      style={{ backgroundColor: 'var(--color-signal)' }}
                    />
                  )}
                </Link>
              </li>
            );
          })}

          {auth?.profile.role === 'creator' && (
            <li className="pt-4 mt-4 border-t border-white/10">
              <Link
                href="/learn/creator"
                aria-current={(pathname === '/learn/creator' || pathname.startsWith('/learn/creator/')) ? 'page' : undefined}
                className={[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                  (pathname === '/learn/creator' || pathname.startsWith('/learn/creator/'))
                    ? 'bg-white/12 text-white'
                    : 'text-white/65 hover:bg-white/8 hover:text-white',
                ].join(' ')}
              >
                <LayoutDashboard
                  className={[
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    (pathname === '/learn/creator' || pathname.startsWith('/learn/creator/')) ? 'text-brand-teal-bright' : 'text-white/55 group-hover:text-white/85',
                  ].join(' ')}
                />
                <span>לוח יוצר</span>
              </Link>
            </li>
          )}

          {auth?.profile.role === 'admin' && (
            <li className="pt-4 mt-4 border-t border-white/10">
              <Link
                href="/admin"
                aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
                className={[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-white/12 text-white'
                    : 'text-white/65 hover:bg-white/8 hover:text-white',
                ].join(' ')}
              >
                <ShieldCheck
                  className={[
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    pathname.startsWith('/admin') ? 'text-brand-teal-bright' : 'text-white/55 group-hover:text-white/85',
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
        <div className="px-5 py-3 border-t border-white/8 flex items-center justify-center gap-1.5">
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
                className="w-8 h-8 rounded-pill flex items-center justify-center text-white/55 hover:text-white hover:bg-white/8 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            );
          })}
        </div>
      )}

      {/* Bottom block — user chip / join CTA */}
      <div className="px-3 py-4 border-t border-white/8 space-y-2">
        {auth ? (
          <>
            <Link
              href="/learn/account"
              className="flex items-center gap-3 px-3 py-2.5 rounded-card bg-white/6 hover:bg-white/10 transition-colors border border-white/8"
            >
              <div className="w-9 h-9 rounded-pill bg-white/15 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(auth.profile.full_name ?? auth.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-white truncate" dir="ltr">
                  {auth.email}
                </span>
                <span className="text-[10px] text-white/55 mt-0.5 flex items-center gap-1.5">
                  {roleLabel}
                  {hasAccess && (
                    <span
                      className="inline-block w-1 h-1 rounded-full"
                      style={{ backgroundColor: 'var(--color-signal)' }}
                      aria-hidden
                    />
                  )}
                </span>
              </div>
            </Link>
            <LogoutButton className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-pill border border-white/12 hover:border-white/30 text-white/70 hover:text-white text-xs font-medium transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              התנתק
            </LogoutButton>
          </>
        ) : (
          <>
            <Link
              href="/upgrade"
              className="block w-full text-center px-3 py-2.5 rounded-pill bg-white text-brand-purple-700 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ boxShadow: 'var(--shadow-btn)' }}
            >
              הירשם למועדון
            </Link>
            <Link
              href="/login"
              className="block w-full text-center px-3 py-2 rounded-pill border border-white/15 hover:border-white/30 text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              התחבר
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
