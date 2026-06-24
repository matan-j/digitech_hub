import Link from 'next/link';
import { requireUser } from '@/lib/auth';

export const metadata = {
  title: 'ברוך הבא למועדון — Digitech Learning Hub',
};

type Props = {
  searchParams: Promise<{ return?: string }>;
};

export default async function UpgradeSuccessPage({ searchParams }: Props) {
  const { return: returnTo } = await searchParams;
  await requireUser('/learn/account');
  // Note: webhook may take 1-2s to land. The page is reachable regardless;
  // we trust the user just paid and show success. The DB will catch up.

  return (
    <main className="min-h-screen px-4 py-10 flex items-center" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-pill bg-emerald-100 flex items-center justify-center text-3xl">
          🎉
        </div>
        <h1 className="text-2xl font-extrabold text-neutral-950 mb-2">
          ברוך הבא למועדון!
        </h1>
        <p className="text-neutral-600 mb-6">
          התשלום התקבל. יש לך גישה מלאה ל-Hub.
          אם הגישה לא מופיעה מיד — רענן את הדף בעוד כמה שניות.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={returnTo ?? '/learn'}
            className="px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold transition-colors"
          >
            {returnTo ? 'המשך לתוכן' : 'התחל ללמוד'}
          </Link>
          <Link
            href="/learn/account"
            className="px-4 py-2.5 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-800 text-sm font-medium transition-colors"
          >
            ניהול החשבון
          </Link>
        </div>
      </div>
    </main>
  );
}
