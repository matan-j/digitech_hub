import { requireAdmin } from '@/lib/auth';
import AccessConsole from './AccessConsole';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'גישות והזמנות — ניהול' };

export default async function AdminAccessPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-neutral-950">גישות והזמנות</h1>
        <p className="text-sm text-neutral-600 mt-1">
          ניהול גישת תלמידים לקורסים — הענקה ידנית, שלילה (ללא מחיקת התקדמות), ומעקב אחר בקשות רכישה.
        </p>
      </header>
      <AccessConsole />
    </div>
  );
}
