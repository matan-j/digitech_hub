import { listCategories } from '@/lib/learn/db';
import TaxonomyManager from './TaxonomyManager';

export const metadata = { title: 'תחומים וקטגוריות — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage() {
  const categories = await listCategories();
  return (
    <div className="px-8 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">תחומים וקטגוריות</h1>
        <p className="text-sm text-neutral-500 mt-1">
          תחומים הם קבועים במערכת (6). קטגוריות גמישות וניתנות לעריכה — הן מופיעות בעורכי הדרכות ופלייבוקים לסיווג.
        </p>
      </header>

      <TaxonomyManager initial={categories} />
    </div>
  );
}
