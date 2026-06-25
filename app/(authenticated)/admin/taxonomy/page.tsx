import { DOMAINS, domainDotClasses } from '@/lib/learn/domains';

export const metadata = { title: 'תחומים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default function TaxonomyPage() {
  return (
    <div className="px-8 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">תחומים</h1>
        <p className="text-sm text-neutral-500 mt-1">
          התחומים הם קבועים במערכת (6) ומשמשים לסיווג קורסים, הדרכות ופלייבוקים.
          בחירת התחום מתבצעת בעורך של כל פריט.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOMAINS.map((d) => (
          <section
            key={d.id}
            className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center gap-3"
          >
            <span className={['w-2.5 h-2.5 rounded-pill', domainDotClasses(d.id)].join(' ')} aria-hidden />
            <div>
              <h3 className="font-extrabold text-neutral-950">{d.label}</h3>
              <span className="text-[11px] text-neutral-400 font-mono">{d.id}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
