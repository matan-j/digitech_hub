import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireCreator } from '@/lib/auth';
import { getGuide } from '@/lib/learn/db';
import GuideEditor from '@/components/learn-admin/GuideEditor';
import CreatorDashboardNav from '@/components/creator/CreatorDashboardNav';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGuide(slug);
  return { title: g ? `${g.title} — עריכה` : 'הדרכה לא נמצאה' };
}

export default async function CreatorGuideEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { creator } = await requireCreator(`/learn/creator/guides/${slug}`);
  const guide = await getGuide(slug);
  // Owner check: a creator may only edit their own guides.
  if (!guide || !creator || guide.creator_id !== creator.id) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold text-neutral-950 mb-6">לוח יוצר</h1>
      <CreatorDashboardNav />
      <Link href="/learn/creator/guides" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה להדרכות שלי
      </Link>
      <GuideEditor initial={guide} mode="creator" backHref="/learn/creator/guides" />
    </div>
  );
}
