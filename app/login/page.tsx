import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getBrandLogoUrl } from '@/lib/brand';
import { getCurrentUser } from '@/lib/auth';
import { Sparkles, Compass, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'התחברות · DigiTech HUB',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ return?: string; next?: string; error?: string; detail?: string }>;
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
  const { return: returnRaw, next: nextRaw, error, detail } = await searchParams;
  const returnTo = returnRaw ?? nextRaw;

  // Already signed in? Skip the form.
  const auth = await getCurrentUser();
  if (auth) {
    const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/learn';
    redirect(safe);
  }

  const logoUrl = await getBrandLogoUrl();
  const errorLabel = error ? (ERROR_LABELS[error] ?? error) : null;

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      {/* ===== Branded hero (right in RTL) ===== */}
      <section
        className="relative hidden lg:flex flex-col justify-between text-white p-10 xl:p-14 overflow-hidden"
        style={{ backgroundImage: 'var(--grad-hero)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 90% 12%, rgba(196,184,230,0.20), transparent 50%), radial-gradient(circle at 8% 95%, rgba(31,181,138,0.14), transparent 55%)',
          }}
        />
        <div className="relative">
          <Link href="/learn" className="inline-flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="DigiTech"
                className="w-11 h-11 rounded-[12px] object-cover bg-white/8 p-1"
              />
            ) : (
              <span
                className="brand-badge"
                style={{ ['--s' as never]: '44px' }}
                aria-hidden
              >
                <span className="swoosh" />
              </span>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-white text-lg tracking-tight">
                DigiTech
                <span className="text-brand-teal-bright text-[11px] tracking-wider align-top mr-1">HUB</span>
              </span>
              <span className="text-xs text-white/60">השכלה פרקטית</span>
            </div>
          </Link>
        </div>

        <div className="relative max-w-md">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-pill text-[11px] font-bold tracking-wide text-white"
            style={{ backgroundColor: 'rgba(31,181,138,0.22)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-signal)' }} />
            מועדון הלמידה של Digitech
          </span>
          <h2 className="mt-4 text-3xl xl:text-4xl font-extrabold leading-[1.1] tracking-tight">
            בנה את העסק שלך,
            <br />
            <span className="text-brand-purple-100">שיעור אחד כל פעם.</span>
          </h2>
          <p className="mt-4 text-white/75 text-base xl:text-lg leading-relaxed max-w-sm">
            קורסים, הדרכות ופלייבוקים פרקטיים — נבחרים בקפידה כדי שתתקדם, לא רק תצרוך תוכן.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <Bullet icon={BookOpen}>גישה מלאה לכל הקורסים</Bullet>
            <Bullet icon={Compass}>הדרכות פרקטיות שמכוונות לפעולה</Bullet>
            <Bullet icon={Sparkles}>פלייבוקים מבוססי AI מותאמים אליך</Bullet>
          </ul>
        </div>

        <div className="relative text-xs text-white/45">
          © DigiTech HUB
        </div>
      </section>

      {/* ===== Form card (left in RTL) ===== */}
      <section className="flex items-center justify-center px-4 py-10 sm:py-14">
        <div
          className="w-full max-w-md bg-white rounded-panel border border-neutral-200 p-8 sm:p-10"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {/* Mobile lockup */}
          <Link href="/learn" className="lg:hidden flex items-center gap-2.5 mb-6">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="DigiTech" className="w-10 h-10 rounded-pill object-cover" />
            ) : (
              <span
                className="brand-badge"
                style={{ ['--s' as never]: '40px' }}
                aria-hidden
              >
                <span className="swoosh" />
              </span>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-neutral-950 text-lg leading-tight">
                DigiTech
                <span className="text-brand-purple-500 text-[10px] tracking-wider align-top mr-1">HUB</span>
              </span>
              <span className="text-[11px] text-neutral-500 leading-tight">השכלה פרקטית</span>
            </div>
          </Link>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 mb-1.5">ברוך הבא</h1>
          <p className="text-sm text-neutral-700 mb-6">
            התחבר כדי להמשיך לקורסים, ההדרכות והפלייבוקים שלך.
          </p>

          {errorLabel && (
            <div
              className="mb-4 px-3 py-2.5 rounded-card text-sm"
              style={{
                backgroundColor: 'rgba(224,86,123,0.08)',
                border: '1px solid rgba(224,86,123,0.32)',
                color: '#A5354B',
              }}
            >
              <div className="font-semibold">{errorLabel}</div>
              {detail && <div className="text-xs mt-1 break-all opacity-80" dir="ltr">{detail}</div>}
            </div>
          )}

          <LoginForm returnTo={returnTo} />
        </div>
      </section>
    </main>
  );
}

function Bullet({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-white/85">
      <span
        className="w-7 h-7 rounded-pill flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
      >
        <Icon className="w-3.5 h-3.5 text-brand-teal-bright" />
      </span>
      <span>{children}</span>
    </li>
  );
}
