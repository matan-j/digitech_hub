import Link from 'next/link';
import { adminCounts } from '@/lib/learn/db';
import { BookOpen, Compass, BookText, Plus } from 'lucide-react';

export const metadata = { title: 'ניהול — Digitech Learning Hub' };

export default async function AdminDashboard() {
  const counts = await adminCounts();

  const cards = [
    {
      href: '/admin/courses',
      newHref: '/admin/courses/new',
      label: 'קורסים',
      icon: BookOpen,
      stat: counts.courses.total,
      sub: `${counts.courses.published} מפורסמים`,
      color: 'bg-brand-purple-50 text-brand-purple-700',
    },
    {
      href: '/admin/guides',
      newHref: '/admin/guides/new',
      label: 'הדרכות',
      icon: Compass,
      stat: counts.guides.total,
      sub: `${counts.guides.published} מפורסמים`,
      color: 'bg-brand-blue-100 text-brand-blue-700',
    },
    {
      href: '/admin/playbooks',
      newHref: undefined,
      label: 'פלייבוקים',
      icon: BookText,
      stat: counts.playbooks,
      sub: 'נוצרים אוטומטית מקורסים/סרטונים',
      color: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-950">ניהול תוכן</h1>
        <p className="text-neutral-500 mt-1.5">מבט-על על כל התוכן ב-Hub וניווט מהיר לעריכה.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.href} className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-pill flex items-center justify-center ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {c.newHref && (
                  <Link
                    href={c.newHref}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-pill bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    חדש
                  </Link>
                )}
              </div>
              <Link href={c.href} className="block group">
                <div className="text-3xl font-extrabold text-neutral-950 mb-0.5">{c.stat}</div>
                <div className="font-semibold text-neutral-800 group-hover:text-brand-purple-700 transition-colors">{c.label}</div>
                <div className="text-xs text-neutral-500 mt-1">{c.sub}</div>
              </Link>
            </div>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-extrabold text-neutral-500 uppercase tracking-wide mb-3">פעולות מהירות</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/admin/guides/new" className="bg-white rounded-xl border border-neutral-200 p-4 hover:border-brand-purple-300 transition-colors">
            <div className="font-semibold text-neutral-900">צור הדרכה חדשה</div>
            <div className="text-xs text-neutral-500 mt-0.5">תוכן ארוך עם markdown, תמונות, וידאו וקישורים</div>
          </Link>
          <Link href="/admin/courses/new" className="bg-white rounded-xl border border-neutral-200 p-4 hover:border-brand-purple-300 transition-colors">
            <div className="font-semibold text-neutral-900">צור קורס חדש</div>
            <div className="text-xs text-neutral-500 mt-0.5">סדרת שיעורים עם וידאו, חומרים ופלייבוק</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
