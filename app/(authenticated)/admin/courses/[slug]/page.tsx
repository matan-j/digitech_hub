import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getCourseWithModules } from '@/lib/learn/db';
import CourseEditor from '@/components/learn-admin/CourseEditorV1';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCourseWithModules(slug);
  return { title: c ? `${c.title} — עריכה` : 'קורס לא נמצא' };
}

export default async function CourseEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseWithModules(slug);
  if (!course) notFound();

  return (
    <div className="px-8 py-8 max-w-4xl">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-4">
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה לרשימת קורסים
      </Link>
      <CourseEditor initial={course} />
    </div>
  );
}
