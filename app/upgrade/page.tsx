import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import UpgradeButton from './UpgradeButton';

export const metadata = {
  title: 'הצטרף למועדון — Digitech Learning Hub',
};

const PERKS = [
  'גישה מלאה לכל הקורסים',
  'כל ההדרכות והפלייבוקים',
  'מעקב התקדמות אישי',
  'תוכן חדש מתעדכן באופן שוטף',
];

type Props = {
  searchParams: Promise<{ return?: string }>;
};

export default async function UpgradePage({ searchParams }: Props) {
  const { return: returnTo } = await searchParams;
  const auth = await getCurrentUser();

  if (auth && hasPremiumAccess(auth.profile)) {
    redirect(returnTo ?? '/learn/account');
  }

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <div className="max-w-xl mx-auto">
        <Link href="/learn" className="text-sm text-brand-purple-700 hover:text-brand-purple-800 font-medium">
          ← חזרה ל-Hub
        </Link>

        <div className="bg-white rounded-2xl border border-neutral-200 p-8 mt-4 shadow-sm">
          <span className="inline-block px-2.5 py-1 rounded-pill bg-brand-purple-100 text-brand-purple-800 text-xs font-semibold mb-3">
            מועדון Digitech
          </span>
          <h1 className="text-3xl font-extrabold text-neutral-950 mb-2">
            פתח גישה מלאה ל-Learning Hub
          </h1>
          <p className="text-neutral-600 mb-6">
            מנוי חודשי לכל התוכן — קורסים, הדרכות, פלייבוקים והכל בלי הגבלה.
          </p>

          <ul className="space-y-2 mb-8">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm text-neutral-800">
                <svg className="w-5 h-5 text-brand-purple-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {auth ? (
            <UpgradeButton returnTo={returnTo} />
          ) : (
            <Link
              href={`/login${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}`}
              className="block w-full text-center px-4 py-3 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold transition-colors"
            >
              התחבר כדי להירשם
            </Link>
          )}
          <p className="text-xs text-neutral-500 text-center mt-3">
            ניתן לבטל בכל עת מאזור החשבון
          </p>
        </div>
      </div>
    </main>
  );
}
