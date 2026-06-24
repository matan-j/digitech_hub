import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireCreator } from '@/lib/auth';
import NewGuideForm from './NewGuideForm';

export const metadata = { title: 'הדרכה חדשה · לוח יוצר' };
export const dynamic = 'force-dynamic';

export default async function NewCreatorGuidePage() {
  await requireCreator('/learn/creator/guides/new');
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-2xl mx-auto">
      <Link href="/learn/creator/guides" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה להדרכות שלי
      </Link>
      <h1 className="text-2xl font-extrabold text-neutral-950 mb-6">הדרכה חדשה</h1>
      <NewGuideForm />
    </div>
  );
}
