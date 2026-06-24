/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';
import { getBrandLogoUrl } from '@/lib/brand';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'תנאי שימוש',
  description: 'תנאי השימוש של DigiTech HUB — הכללים שמסדירים את השימוש שלך בפלטפורמה.',
};

export const dynamic = 'force-dynamic';

const LAST_UPDATED = '5 ביוני 2026';
const CONTACT_EMAIL = 'office@digi-tech.co.il';

export default async function TermsPage() {
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
            תנאי שימוש
          </h1>
          <p className="mt-2 text-sm text-neutral-500">עודכן לאחרונה: {LAST_UPDATED}</p>

          <section className="mt-8 space-y-8 text-neutral-800 leading-[1.7]">
            <Intro>
              ברוך הבא ל-DigiTech HUB (להלן: <strong>"הפלטפורמה"</strong>). תנאים אלה מסדירים את השימוש שלך בפלטפורמה
              ובכל התוכן והשירותים הזמינים בה. עצם השימוש בפלטפורמה מהווה הסכמתך לתנאים אלה במלואם. אם אינך מסכים — אנא הימנע משימוש בפלטפורמה.
            </Intro>

            <Section title="1. הגדרות">
              <List items={[
                <><strong>"החברה"</strong> — Digitech, מפעילת הפלטפורמה.</>,
                <><strong>"משתמש"</strong> / <strong>"אתה"</strong> — כל מי שנכנס, נרשם או משתמש בפלטפורמה.</>,
                <><strong>"תוכן"</strong> — קורסים, סרטונים, הדרכות, פלייבוקים, טקסטים, תמונות, וכל חומר אחר שמוצג בפלטפורמה.</>,
              ]} />
            </Section>

            <Section title="2. כשירות להשתמש בפלטפורמה">
              <p>השימוש בפלטפורמה מותר לכל אדם שמלאו לו 16 שנה. שימוש על-ידי קטין מתחת לגיל 16 אסור. אם אתה מתחת לגיל 18, השימוש מותנה באישור הורה או אפוטרופוס.</p>
              <p>החברה רשאית לסרב לאפשר שימוש בפלטפורמה לכל אדם לפי שיקול דעתה הבלעדי, ללא חובת הנמקה.</p>
            </Section>

            <Section title="3. רישום וחשבון משתמש">
              <List items={[
                'בעת הרשמה אתה מתחייב לספק מידע נכון ועדכני.',
                'אתה אחראי לשמירה על סודיות פרטי החשבון שלך — אל תשתף את הסיסמה עם אחרים.',
                'אתה אחראי לכל פעולה שמתבצעת בחשבונך.',
                'אם תזהה שימוש לא מורשה בחשבונך — דווח לנו מיד.',
                'חשבון אחד מיועד למשתמש אחד. שיתוף חשבון בין מספר אנשים אסור.',
              ]} />
            </Section>

            <Section title="4. שימוש מותר ושימוש אסור">
              <p><strong>מותר לך:</strong></p>
              <List items={[
                'לצפות בתוכן שזמין לחשבונך לצורכי למידה אישית.',
                'לשמור הערות וקבצים אישיים בכלים שהפלטפורמה מספקת.',
                'לשתף קישורים פומביים שהפלטפורמה מאפשרת לשתף.',
              ]} />
              <p className="mt-4"><strong>אסור לך:</strong></p>
              <List items={[
                'להוריד, לשכפל, להפיץ, למכור או להעביר תוכן של הפלטפורמה לצדדים שלישיים, אלא אם ניתן אישור מפורש בכתב.',
                'להשתמש בכלים אוטומטיים (bots, scrapers, crawlers) כדי לאסוף תוכן מהפלטפורמה.',
                'לנסות לפרוץ, להפר אבטחה, לעקוף הגבלות גישה, או לזהות חולשות בלי הרשאה מפורשת.',
                'להשתמש בפלטפורמה לכל פעילות לא חוקית, פוגענית, מטעה או מפרה זכויות של אחר.',
                'להעלות תוכן שמכיל וירוסים, קוד זדוני, או חומר פוגעני.',
                'ליצור חשבונות מזויפים, או להתחזות לאדם אחר.',
              ]} />
              <p className="mt-3">הפרת סעיף זה עלולה לגרור חסימת חשבון מיידית, ובמקרים חמורים גם נקיטת הליכים משפטיים.</p>
            </Section>

            <Section title="5. קניין רוחני">
              <p>כל הזכויות בתוכן הפלטפורמה — לרבות קורסים, סרטונים, הדרכות, פלייבוקים, טקסטים, גרפיקה, לוגואים, סימני מסחר, קוד המקור, ועיצוב הממשק — שייכות לחברה או למי שהעניק לה רישיון, ומוגנות על-פי דיני זכויות יוצרים והקניין הרוחני בישראל ובעולם.</p>
              <p>השימוש שלך בפלטפורמה מקנה לך <strong>רישיון אישי, לא בלעדי ולא ניתן להעברה</strong> לצפייה בתוכן לצורכי למידה — לא יותר מכך. אינך רוכש בעלות בתוכן, ולא רשאי להשתמש בו לצרכים מסחריים ללא אישור בכתב.</p>
            </Section>

            <Section title="6. תוכן שאתה יוצר">
              אם תיצור תוכן בתוך הפלטפורמה (הערות, פלייבוקים אישיים, חומרים שתעלה) — הוא נשאר בבעלותך. אתה מעניק לחברה רישיון מוגבל לעבד, לאחסן ולהציג אותו לך בלבד לצורך הפעלת השירות. אנחנו לא נשתמש בתוכן הפרטי שלך לצרכים אחרים.
            </Section>

            <Section title="7. הצהרות והגבלות אחריות">
              <List items={[
                'התוכן בפלטפורמה הוא חינוכי-אינפורמטיבי בלבד. הוא אינו מהווה ייעוץ עסקי, משפטי, פיננסי או מקצועי אישי.',
                'החלטות עסקיות או טכנולוגיות שתקבל בהסתמך על התוכן הן באחריותך הבלעדית.',
                'הפלטפורמה ניתנת כפי שהיא ("AS IS"). אנחנו עושים מאמץ סביר לוודא דיוק התוכן וזמינות השירות, אך לא מתחייבים שהשירות יהיה רציף לחלוטין או נקי מתקלות.',
                'אנחנו לא אחראים לנזק עקיף, תוצאתי, או אובדן הכנסות שנגרם משימוש או מחוסר יכולת לשמש בפלטפורמה.',
              ]} />
            </Section>

            <Section title="8. שירותים של צד שלישי">
              הפלטפורמה משתמשת בשירותים של צדדים שלישיים (כגון Google ל-OAuth, Supabase לתשתית, Vercel לאחסון). שירותים אלה כפופים לתנאים ולמדיניות הפרטיות של אותם הספקים, ואנו לא אחראים על פעולתם או על שינויים בתנאיהם.
            </Section>

            <Section title="9. שינויים בפלטפורמה ובתנאים">
              <List items={[
                'החברה רשאית לעדכן, להוסיף, או להסיר תוכן ופיצ\'רים בכל עת, לפי שיקול דעתה.',
                'תנאי שימוש אלה עשויים להתעדכן מעת לעת. שינויים מהותיים יידעו אותך במייל או בהודעה בולטת בפלטפורמה לפחות 14 ימים מראש.',
                'המשך השימוש לאחר עדכון התנאים מהווה הסכמה לגרסה החדשה.',
              ]} />
            </Section>

            <Section title="10. ביטול והפסקת שירות">
              <p>אתה רשאי למחוק את חשבונך בכל עת על-ידי פנייה למייל <a className="text-brand-purple-700 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
              <p>החברה רשאית לחסום או למחוק חשבון משתמש שמפר תנאים אלה, או במקרים של חשד לפעילות פוגענית, לאחר מתן הודעה סבירה (אלא אם הנסיבות מצדיקות חסימה מיידית).</p>
            </Section>

            <Section title="11. הדין החל וסמכות שיפוט">
              על תנאים אלה ועל כל מחלוקת שתעלה מהם חל הדין הישראלי בלבד. סמכות השיפוט הבלעדית בכל עניין הקשור לתנאים אלה נתונה לבתי המשפט המוסמכים במחוז תל אביב, ישראל.
            </Section>

            <Section title="12. כללי">
              <List items={[
                'אם הוראה כלשהי מתנאים אלה תיקבע כבטלה או לא ניתנת לאכיפה — שאר ההוראות יישארו בתוקף.',
                'אי-אכיפה של זכות כלשהי לא תיחשב כוויתור עליה.',
                'תנאים אלה הם ההסכם המלא ביניך לבין החברה בנושא השימוש בפלטפורמה.',
              ]} />
            </Section>

            <Section title="13. יצירת קשר">
              <p>לכל שאלה לגבי תנאי השימוש:</p>
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
