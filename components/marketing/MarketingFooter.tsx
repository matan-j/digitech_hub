import Link from 'next/link';

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'גלה',
    links: [
      { label: 'קורסים', href: '/learn/courses' },
      { label: 'הדרכות', href: '/learn/guides' },
      { label: 'יוצרים', href: '/learn/creators' },
      { label: 'פלייליסטים', href: '/learn/playlists' },
    ],
  },
  {
    title: 'מועדון',
    links: [
      { label: 'אזור הלמידה', href: '/learn' },
      { label: 'התחברות', href: '/login' },
    ],
  },
  {
    title: 'מידע',
    links: [
      { label: 'תנאי שימוש', href: '/terms' },
      { label: 'פרטיות', href: '/privacy' },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="font-extrabold text-neutral-950 text-lg tracking-tight">
            DigiTech<span className="text-brand-teal align-top text-[10px] font-extrabold tracking-wider mr-1">HUB</span>
          </span>
          <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-xs">
            פלטפורמת הלמידה הפרקטית של דיגיטק — קורסים, הדרכות ופלייבוקים מהיוצרים המובילים בישראל.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-neutral-600 hover:text-brand-purple-700 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-neutral-400">
          © {new Date().getFullYear()} Digitech · השכלה פרקטית
        </div>
      </div>
    </footer>
  );
}
