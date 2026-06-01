import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { LogOut, ArrowRight } from 'lucide-react';
import AdminNav from './AdminNavItem';
import { getBrandLogoUrl } from '@/lib/brand';
import LogoutButton from '@/components/auth/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ email, profile }, logoUrl] = await Promise.all([requireAdmin(), getBrandLogoUrl()]);

  return (
    <div className="min-h-screen bg-brand-purple-50">
      <aside className="fixed right-0 top-0 h-full w-60 z-40 bg-white border-l border-brand-purple-200 flex flex-col">
        <div className="px-5 py-5 border-b border-brand-purple-200">
          <Link href="/admin" className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Digitech" className="w-9 h-9 rounded-pill object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white font-bold text-sm">
                D
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-neutral-950 leading-tight">Digitech</span>
              <span className="text-[11px] text-neutral-500 leading-tight">ניהול תוכן</span>
            </div>
          </Link>
        </div>

        <nav className="px-3 py-4 flex-1 overflow-y-auto">
          <AdminNav />
        </nav>

        <div className="px-3 py-4 border-t border-brand-purple-200 space-y-2">
          <Link
            href="/learn"
            className="flex items-center gap-2 px-3.5 py-2 rounded-pill text-xs text-neutral-600 hover:bg-brand-purple-50 hover:text-neutral-950 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            חזרה ל-Learning Hub
          </Link>
          <div className="px-3 py-2.5 rounded-card bg-brand-purple-50">
            <div className="text-[11px] text-neutral-500">מחובר כ-{profile.role === 'admin' ? 'אדמין' : 'משתמש'}</div>
            <div className="text-xs font-medium text-neutral-950 truncate" dir="ltr">{email}</div>
          </div>
          <LogoutButton className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-pill border border-brand-purple-200 text-neutral-600 text-xs font-medium hover:border-brand-purple-400 hover:text-neutral-950 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            התנתק
          </LogoutButton>
        </div>
      </aside>

      <main className="mr-60 min-h-screen">{children}</main>
    </div>
  );
}
