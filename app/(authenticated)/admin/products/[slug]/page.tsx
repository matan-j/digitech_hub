import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getBundleWithCourses, listContent } from '@/lib/learn/db';
import BundleEditor from '@/components/learn-admin/BundleEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBundleWithCourses(slug);
  return { title: b ? `${b.title} — עריכה` : 'מוצר לא נמצא' };
}

export default async function ProductEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [bundle, allCourses] = await Promise.all([getBundleWithCourses(slug), listContent('course')]);
  if (!bundle) notFound();

  // Minimal course options for the dropdown — id/title/slug/status only.
  const courseOptions = allCourses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
  }));

  return (
    <div className="px-8 py-8 max-w-4xl">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה לרשימת מוצרים
      </Link>
      <BundleEditor initial={bundle} courseOptions={courseOptions} />
    </div>
  );
}
