import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { getBrandLogoUrl } from '@/lib/brand';

export const metadata = {
  title: 'התחברות — Digitech Learning Hub',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ return?: string; error?: string; detail?: string }>;
};

const ERROR_LABELS: Record<string, string> = {
  missing_params: 'התקבל קישור התחברות לא תקין. נסה להתחבר שוב.',
  missing_type: 'הקישור פגום (חסר type). בקש קישור חדש.',
  exchange_failed: 'אימות נכשל. ייתכן שהקישור פג תוקף — נסה שוב.',
  verify_failed: 'הקישור פג תוקף או כבר נוצל. בקש קישור חדש.',
  callback_crashed: 'אירעה שגיאה במהלך ההתחברות.',
  auth_failed: 'אימות נכשל.',
};

export default async function LoginPage({ searchParams }: Props) {
  const { return: returnTo, error, detail } = await searchParams;
  const logoUrl = await getBrandLogoUrl();
  const errorLabel = error ? (ERROR_LABELS[error] ?? error) : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-brand-purple-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-panel border border-brand-purple-200 p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <Link href="/learn" className="flex items-center gap-2.5 mb-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Digitech" className="w-10 h-10 rounded-pill object-cover bg-white" />
          ) : (
            <div className="w-10 h-10 rounded-pill bg-brand-purple-700 flex items-center justify-center text-white font-bold">
              D
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-extrabold text-neutral-950 text-lg leading-tight">Digitech</span>
            <span className="text-xs text-neutral-500 leading-tight">Learning Hub</span>
          </div>
        </Link>
        <h1 className="text-2xl font-extrabold text-neutral-950 mb-1.5">ברוך הבא</h1>
        <p className="text-sm text-neutral-600 mb-5">
          התחבר עם Google או מייל וסיסמה
        </p>

        {errorLabel && (
          <div className="mb-4 px-3 py-2.5 rounded-card bg-red-50 border border-red-200 text-sm text-red-800">
            <div className="font-semibold">{errorLabel}</div>
            {detail && <div className="text-xs text-red-700 mt-1 break-all" dir="ltr">{detail}</div>}
          </div>
        )}

        <LoginForm returnTo={returnTo} />
      </div>
    </main>
  );
}
