/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';
import { getBrandLogoUrl } from '@/lib/brand';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'מדיניות פרטיות',
  description: 'מדיניות הפרטיות של DigiTech HUB — איך אנחנו אוספים, שומרים ומגנים על המידע שלך.',
};

export const dynamic = 'force-dynamic';

const LAST_UPDATED = '5 ביוני 2026';
const CONTACT_EMAIL = 'office@digi-tech.co.il';

export default async function PrivacyPage() {
  const logoUrl = await getBrandLogoUrl();

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/learn" className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="DigiTech" className="w-9 h-9 rounded-[10px] object-cover" />
            ) : (
              <span className="brand-badge" style={{ ['--s' as never]: '36px' }} aria-hidden>
                <span className="swoosh" />
              </span>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-neutral-950 text-base">
                DigiTech
                <span className="text-brand-purple-500 text-[10px] tracking-wider align-top mr-1">HUB</span>
              </span>
            </div>
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-brand-purple-700 transition-colors"
          >
            <span>חזרה ל-HUB</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="bg-white rounded-panel border border-neutral-200 p-6 sm:p-10" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-950 tracking-tight">
            מדיניות פרטיות
          </h1>
          <p className="mt-2 text-sm text-neutral-500">עודכן לאחרונה: {LAST_UPDATED}</p>

          <section className="mt-8 space-y-8 text-neutral-800 leading-[1.7]">
            <Intro>
              במדיניות הפרטיות הזו אנו מסבירים איזה מידע אנו אוספים עליך כשאתה משתמש ב-DigiTech HUB
              (להלן: <strong>"הפלטפורמה"</strong>), איך אנחנו משתמשים בו, איפה הוא שמור, ומה הזכויות שלך לגביו.
              השימוש בפלטפורמה מהווה הסכמתך למדיניות זו.
            </Intro>

            <Section title="1. מי אנחנו">
              הפלטפורמה מופעלת על-ידי <strong>Digitech</strong>, מועדון הלמידה הפרקטי בתחומי AI, דיגיטל ועסקים.
              לכל שאלה אפשר ליצור קשר במייל <a className="text-brand-purple-700 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </Section>

            <Section title="2. איזה מידע אנו אוספים">
              <p>אנחנו אוספים את הסוגים הבאים של מידע:</p>
              <List items={[
                <><strong>מידע חשבון</strong> — בעת הרשמה דרך Google אנו מקבלים שם פרטי, כתובת מייל ותמונת פרופיל. בעת הרשמה במייל וסיסמה אנו שומרים את כתובת המייל ואת הסיסמה שלך באופן מוצפן.</>,
                <><strong>מידע למידה</strong> — קורסים בהם צפית, הדרכות שקראת, פלייבוקים שהפעלת, התקדמות במודולים והעדפות תוכן.</>,
                <><strong>מידע טכני</strong> — כתובת IP, סוג דפדפן, מערכת הפעלה, שעת כניסה, וקבצי לוגים סטנדרטיים — נאספים אוטומטית לצרכי תפעול ואבטחה.</>,
                <><strong>מידע שיצרת בעצמך</strong> — חומרים, הערות או שמות פלייבוק שייצרת בתוך הפלטפורמה.</>,
              ]} />
            </Section>

            <Section title="3. איך אנחנו משתמשים במידע">
              <List items={[
                'לספק לך גישה לתוכן: קורסים, הדרכות, פלייבוקים, התקדמות אישית.',
                'להתאים אישית המלצות תוכן וחוויית למידה.',
                'לתקשר איתך לגבי עדכוני תוכן, פיצ\'רים חדשים, או נושאי שירות (לא ספאם — נשלח רק מה שרלוונטי).',
                'לאבטח את הפלטפורמה ולמנוע שימוש לרעה.',
                'לעמוד בדרישות חוקיות במידת הצורך.',
              ]} />
              <p className="mt-3">אנחנו <strong>לא</strong> מוכרים את המידע שלך לצדדים שלישיים, ולא מציגים פרסומות חיצוניות בפלטפורמה.</p>
            </Section>

            <Section title="4. שותפי שירות (Sub-processors)">
              <p>כדי להפעיל את הפלטפורמה אנו משתמשים בספקי תשתית מובילים. כולם כפופים להסכמי DPA ו-GDPR:</p>
              <List items={[
                <><strong>Supabase</strong> — מסד נתונים, מערכת התחברות, ואחסון קבצים. שרתים באירופה.</>,
                <><strong>Google OAuth</strong> — אימות הזהות שלך כשאתה בוחר להתחבר דרך Google.</>,
                <><strong>Vercel</strong> — אחסון ושליחת קוד האתר.</>,
              ]} />
              <p className="mt-3">אם נוסיף ספקי שירות נוספים בעתיד, נעדכן את מדיניות זו בהתאם.</p>
            </Section>

            <Section title="5. שמירה והגנה על המידע">
              <List items={[
                'הסיסמה שלך מאוחסנת באופן מוצפן (hashing). אין לנו גישה לסיסמה הגולמית.',
                'התעבורה בין הדפדפן שלך לשרת מוצפנת ב-HTTPS.',
                'הגישה לנתונים שלך מוגבלת בהרשאות מסד נתונים (Row Level Security). משתמש אחר לא יכול לראות את הנתונים שלך.',
                'אנחנו שומרים את המידע שלך כל עוד יש לך חשבון פעיל. אם תבקש למחוק את חשבונך, המידע יימחק.',
              ]} />
            </Section>

            <Section title="6. הזכויות שלך">
              <p>בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, ולתקנות הרלוונטיות, יש לך את הזכויות הבאות:</p>
              <List items={[
                <><strong>זכות עיון</strong> — לראות איזה מידע אנו מחזיקים עליך.</>,
                <><strong>זכות תיקון</strong> — לעדכן או לתקן מידע שגוי.</>,
                <><strong>זכות מחיקה</strong> — לבקש מחיקת חשבונך והמידע הקשור אליו.</>,
                <><strong>זכות הגבלת עיבוד</strong> — לבקש שלא נשתמש במידע שלך לצורכי תקשורת שיווקית.</>,
                <><strong>זכות לקבל את המידע שלך</strong> — לבקש קובץ עם הנתונים שלך בפורמט נייד.</>,
              ]} />
              <p className="mt-3">למימוש כל אחת מהזכויות פנה אלינו במייל <a className="text-brand-purple-700 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. נשיב לך תוך 30 ימים.</p>
            </Section>

            <Section title="7. עוגיות ומידע טכני">
              <p>הפלטפורמה משתמשת בעוגיות (cookies) חיוניות בלבד:</p>
              <List items={[
                'עוגיות סשן (Supabase Auth) — כדי שתישאר מחובר בין דפים.',
                'עוגיות מועדפות — לזכור העדפות תצוגה.',
              ]} />
              <p className="mt-3">אנחנו <strong>לא</strong> משתמשים בעוגיות מעקב פרסומי (advertising trackers) או בעוגיות צד שלישי לצורכי שיווק.</p>
            </Section>

            <Section title="8. שמירת המידע">
              <p>מידע פעיל נשמר כל עוד יש לך חשבון בפלטפורמה. לאחר מחיקת חשבון:</p>
              <List items={[
                'נתונים אישיים יימחקו תוך 30 ימים.',
                'גיבויים שכוללים מידע שלך יוסרו אוטומטית במסגרת מחזור הגיבוי (עד 90 ימים).',
                'לוגים אנונימיים שאינם מזהים אותך עשויים להישמר לצרכים סטטיסטיים.',
              ]} />
            </Section>

            <Section title="9. ילדים מתחת לגיל 16">
              הפלטפורמה אינה מיועדת לקטינים מתחת לגיל 16. אם נודע לנו שאספנו בטעות מידע על ילד מתחת לגיל 16, נמחק אותו לאלתר. אם אתה הורה ומאמין שילדך מסר לנו מידע — צור איתנו קשר במייל לעיל.
            </Section>

            <Section title="10. שינויים במדיניות">
              אנחנו עשויים לעדכן את המדיניות מעת לעת. שינויים מהותיים יידעו אותך במייל או בהודעה בולטת בפלטפורמה. תאריך העדכון האחרון תמיד מופיע בראש העמוד.
            </Section>

            <Section title="11. יצירת קשר">
              <p>לכל שאלה, בקשה, או תלונה בנושא פרטיות:</p>
              <p className="mt-2">
                <strong>מייל:</strong>{' '}
                <a className="text-brand-purple-700 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
            </Section>
          </section>
        </div>
      </article>
    </main>
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return <p className="text-base sm:text-lg text-neutral-700">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-950 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 list-none pr-0">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-purple-500 shrink-0" aria-hidden />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
