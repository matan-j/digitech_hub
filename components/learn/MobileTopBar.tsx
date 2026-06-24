'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { AuthState } from '@/lib/auth';
import LogoutButton from '@/components/auth/LogoutButton';

const NAV = [
  { label: 'דאשבורד', href: '/learn' },
  { label: 'קורסים', href: '/learn/courses' },
  { label: 'הדרכות', href: '/learn/guides' },
  { label: 'פלייבוקים', href: '/learn/playbooks' },
  { label: 'יוצרים', href: '/learn/creators' },
];

export default function MobileTopBar({
  auth,
  logoUrl,
}: {
  auth: AuthState | null;
  logoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  // `shown` drives the slide transition; it flips on a frame after mount so the
  // drawer animates in, and flips off before unmount so it animates out.
  const [shown, setShown] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(id);
  }, [open]);

  function closeMenu() {
    setShown(false);
    setTimeout(() => setOpen(false), 300);
  }

  return (
    <>
      <header
        className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 text-white flex items-center justify-between px-4"
        style={{
          backgroundImage:
            'linear-gradient(180deg, #1A0F3D 0%, #2E1A5C 100%)',
        }}
      >
        <button
          type="button"
          aria-label="פתח תפריט"
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 rounded-pill hover:bg-white/8 text-white/85"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/learn" className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="DigiTech" className="w-7 h-7 rounded-pill object-cover" />
          ) : (
            <span
              className="brand-badge"
              style={{ ['--s' as never]: '28px' }}
              aria-hidden
            >
              <span className="swoosh" />
            </span>
          )}
          <span className="font-extrabold text-white text-sm">
            DigiTech
            <span className="text-brand-teal-bright text-[9px] tracking-wider mr-1">HUB</span>
          </span>
        </Link>
        <Link
          href={auth ? '/account' : '/login'}
          aria-label={auth ? 'החשבון שלי' : 'התחבר'}
          className="p-2 -ml-2 rounded-pill text-white/85 text-xs font-semibold hover:bg-white/8"
        >
          {auth ? (auth.profile.full_name ?? auth.email).charAt(0).toUpperCase() : 'כניסה'}
        </Link>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="סגור"
            onClick={closeMenu}
            className={`absolute inset-0 bg-brand-purple-950/60 backdrop-blur-sm transition-opacity duration-300 ${
              shown ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <nav
            className={`absolute inset-y-0 right-0 w-72 h-full flex flex-col text-white shadow-2xl transition-transform duration-300 ease-out ${
              shown ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{
              backgroundImage:
                'linear-gradient(180deg, #1A0F3D 0%, #2E1A5C 60%, #2A1654 100%)',
            }}
          >
            <div className="px-4 py-5 flex items-center justify-between border-b border-white/8">
              <Link href="/learn" onClick={closeMenu} className="flex items-center gap-2.5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="DigiTech" className="w-9 h-9 rounded-pill object-cover" />
                ) : (
                  <span
                    className="brand-badge"
                    style={{ ['--s' as never]: '36px' }}
                    aria-hidden
                  >
                    <span className="swoosh" />
                  </span>
                )}
                <div className="flex flex-col leading-tight">
                  <span className="font-extrabold text-white">
                    DigiTech
                    <span className="text-brand-teal-bright text-[9px] tracking-wider mr-1">HUB</span>
                  </span>
                  <span className="text-[11px] text-white/55">השכלה פרקטית</span>
                </div>
              </Link>
              <button
                type="button"
                aria-label="סגור"
                onClick={closeMenu}
                className="p-1 rounded-pill hover:bg-white/8 text-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {NAV.map((it) => {
                const isActive =
                  pathname === it.href ||
                  (it.href !== '/learn' && pathname.startsWith(it.href));
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={closeMenu}
                      className={[
                        'block px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/12 text-white'
                          : 'text-white/65 hover:bg-white/8 hover:text-white',
                      ].join(' ')}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}

              {auth?.profile.role === 'admin' && (
                <li className="pt-4 mt-4 border-t border-white/10">
                  <Link
                    href="/admin"
                    onClick={closeMenu}
                    className="block px-3.5 py-2.5 rounded-pill text-sm font-medium text-white/65 hover:bg-white/8 hover:text-white"
                  >
                    ניהול תוכן
                  </Link>
                </li>
              )}
            </ul>
            <div className="px-3 py-4 border-t border-white/8 space-y-2">
              {auth ? (
                <>
                  <Link
                    href="/account"
                    onClick={closeMenu}
                    className="block w-full text-center px-3 py-2.5 rounded-pill bg-white text-brand-purple-700 text-sm font-bold"
                  >
                    החשבון שלי
                  </Link>
                  <LogoutButton className="block w-full text-center px-3 py-2 rounded-pill border border-white/15 text-white/75 text-sm font-medium">
                    התנתק
                  </LogoutButton>
                </>
              ) : (
                <>
                  <Link
                    href="/upgrade"
                    onClick={closeMenu}
                    className="block w-full text-center px-3 py-2.5 rounded-pill bg-white text-brand-purple-700 text-sm font-bold"
                  >
                    הירשם למועדון
                  </Link>
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="block w-full text-center px-3 py-2 rounded-pill border border-white/15 text-white/80 text-sm font-medium"
                  >
                    התחבר
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
