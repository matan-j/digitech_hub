'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { AuthState } from '@/lib/auth';
import LogoutButton from '@/components/auth/LogoutButton';

const NAV = [
  { label: 'דאשבורד', href: '/learn' },
  { label: 'קורסים', href: '/learn/courses' },
  { label: 'מדריכים', href: '/learn/guides' },
  { label: 'פלייבוקים', href: '/learn/playbooks' },
];

export default function MobileTopBar({
  auth,
  logoUrl,
}: {
  auth: AuthState | null;
  logoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-brand-purple-200 flex items-center justify-between px-4">
        <button
          type="button"
          aria-label="פתח תפריט"
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 rounded-md hover:bg-brand-purple-50 text-neutral-700"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/learn" className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Digitech" className="w-7 h-7 rounded-pill object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white font-bold text-xs">
              D
            </div>
          )}
          <span className="font-extrabold text-neutral-950 text-sm">Digitech</span>
        </Link>
        <Link
          href={auth ? '/account' : '/login'}
          aria-label={auth ? 'החשבון שלי' : 'התחבר'}
          className="p-2 -ml-2 rounded-md hover:bg-brand-purple-50 text-neutral-700 text-xs font-semibold"
        >
          {auth ? (auth.profile.full_name ?? auth.email).charAt(0).toUpperCase() : 'כניסה'}
        </Link>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="סגור"
            onClick={() => setOpen(false)}
            className="flex-1 bg-neutral-950/40"
          />
          <nav className="w-72 bg-white h-full flex flex-col border-l border-brand-purple-200">
            <div className="px-4 py-4 flex items-center justify-between border-b border-brand-purple-200">
              <Link href="/learn" onClick={() => setOpen(false)} className="flex items-center gap-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Digitech" className="w-7 h-7 rounded-pill object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white font-bold text-xs">
                    D
                  </div>
                )}
                <span className="font-extrabold text-neutral-950">Digitech</span>
              </Link>
              <button
                type="button"
                aria-label="סגור"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-brand-purple-50 text-neutral-700"
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
                      onClick={() => setOpen(false)}
                      className={[
                        'block px-3.5 py-2.5 rounded-pill text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-purple-100 text-brand-purple-900'
                          : 'text-neutral-700 hover:bg-brand-purple-50',
                      ].join(' ')}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}

              {auth?.profile.role === 'admin' && (
                <li className="pt-4 mt-4 border-t border-brand-purple-200">
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="block px-3.5 py-2.5 rounded-pill text-sm font-medium text-neutral-700 hover:bg-brand-purple-50"
                  >
                    ניהול תוכן
                  </Link>
                </li>
              )}
            </ul>
            <div className="px-3 py-4 border-t border-brand-purple-200 space-y-2">
              {auth ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="block w-full text-center px-3 py-2.5 rounded-pill bg-brand-purple-700 text-white text-sm font-semibold"
                  >
                    החשבון שלי
                  </Link>
                  <LogoutButton className="block w-full text-center px-3 py-2 rounded-pill border border-brand-purple-200 text-neutral-700 text-sm font-medium">
                    התנתק
                  </LogoutButton>
                </>
              ) : (
                <>
                  <Link
                    href="/upgrade"
                    onClick={() => setOpen(false)}
                    className="block w-full text-center px-3 py-2.5 rounded-pill bg-brand-purple-700 text-white text-sm font-semibold"
                  >
                    הירשם למועדון
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block w-full text-center px-3 py-2 rounded-pill border border-brand-purple-200 text-neutral-700 text-sm font-medium"
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
