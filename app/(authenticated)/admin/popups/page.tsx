import { listAllPopups } from '@/lib/learn/db';
import PopupsManager from './PopupsManager';

export const dynamic = 'force-dynamic';

export default async function PopupsAdminPage() {
  const popups = await listAllPopups();
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-neutral-950">פופאפים</h1>
        <p className="text-sm text-neutral-500 mt-1">
          יצירה וניהול של חלונות קופצים באתר — עם תנאי תצוגה, תזמון ותוכן עשיר.
        </p>
      </header>
      <PopupsManager initialPopups={popups} />
    </div>
  );
}
