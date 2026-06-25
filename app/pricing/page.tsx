import Link from 'next/link';
import { Check, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getBrandSettings } from '@/lib/brand';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'מחירים — DigiTech HUB',
  description: 'התחילו ללמוד בחינם, או הצטרפו למועדון לגישה מלאה.',
};

const CLUB_PERKS = [
  'עיון חופשי בכל הקורסים, ההדרכות והיוצרים — בלי הרשמה',
  'גישה מלאה לכל שיעורי הקורסים',
  'מעקב התקדמות ושמירת מקום',
  'חומרי עבודה וקבצים להורדה',
  'פלייבוקים אינטראקטיביים ותכנים חדשים מדי שבוע',
];

const APP_PERKS = [
  'גישה מלאה דרך אפליקציית דיגיטק',
  'למידה מהנייד — בכל מקום ובכל זמן',
  'כל התכנים והעדכונים החדשים',
];

export default async function PricingPage() {
  const [auth, brand] = await Promise.all([getCurrentUser(), getBrandSettings()]);

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)' }} className="min-h-screen">
      <MarketingHeader logoUrl={brand.logoUrl} loggedIn={!!auth} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-6 text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-[12px] font-semibold bg-brand-purple-50 text-brand-purple-700 mb-5">
          מסלולים
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-950 tracking-tight">
          מתחילים בחינם. מעמיקים כשמתאים לכם.
        </h1>
        <p className="mt-4 text-lg text-neutral-500 max-w-2xl mx-auto">
          כל התוכן פתוח לגילוי. ההרשמה נדרשת רק כשרוצים להתחיל ללמוד, לעקוב אחרי התקדמות או להוריד חומרים.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-8 grid gap-5 md:grid-cols-2">
        {/* Club — free start + membership in one path */}
        <div
          className="rounded-panel p-8 flex flex-col text-white relative overflow-hidden"
          style={{ backgroundImage: 'linear-gradient(150deg, #2E1A5C 0%, #4A2E8F 65%, #5B3AAE 100%)', boxShadow: 'var(--shadow-elevated)' }}
        >
          <span className="absolute top-6 left-6 inline-flex px-2.5 py-1 rounded-pill text-[11px] font-bold bg-white/15 text-white">
            הכי משתלם
          </span>
          <h2 className="text-xl font-extrabold">מועדון דיגיטק</h2>
          <p className="mt-1 text-sm text-brand-purple-200">מתחילים בחינם — מצטרפים לגישה מלאה</p>
          <div className="mt-5 mb-6">
            <span className="text-4xl font-extrabold">גישה מלאה</span>
          </div>
          <ul className="space-y-3 flex-1">
            {CLUB_PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-white/90">
                <Check className="w-4 h-4 text-brand-teal-bright mt-0.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <Link
            href={auth ? '/upgrade' : '/login?return=/upgrade'}
            className="mt-7 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill bg-white text-brand-purple-800 text-sm font-bold hover:bg-brand-purple-50 transition-colors"
            style={{ boxShadow: 'var(--shadow-btn)' }}
          >
            הצטרפות למועדון
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link href="/learn" className="mt-3 text-center text-sm font-semibold text-brand-purple-200 hover:text-white transition-colors">
            או התחילו בחינם, בלי הרשמה
          </Link>
        </div>

        {/* App subscription */}
        <div className="bg-white rounded-panel border border-neutral-200 p-8 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h2 className="text-xl font-extrabold text-neutral-950">מנוי באפליקציית דיגיטק</h2>
          <p className="mt-1 text-sm text-neutral-500">למידה מהנייד, בכל מקום</p>
          <div className="mt-5 mb-6">
            <span className="text-4xl font-extrabold text-neutral-950">₪99</span>
            <span className="text-sm text-neutral-500 me-1">לחודש</span>
          </div>
          <ul className="space-y-3 flex-1">
            {APP_PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-700">
                <Check className="w-4 h-4 text-brand-purple-600 mt-0.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <Link
            href="#"
            className="mt-7 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-800 text-sm font-bold transition-colors"
          >
            הצטרפות למנוי
          </Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-4 text-center">
        <p className="text-sm text-neutral-500">
          קורסים מסוימים נמכרים גם כרכישה חד-פעמית. מחיר הרכישה מופיע בדף הקורס.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
