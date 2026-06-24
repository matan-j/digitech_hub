import { NextResponse } from 'next/server';
import { enrollInCourse, listMyEnrollments } from '@/lib/learn/enrollment';

export const runtime = 'nodejs';

// POST { slug } — enrol the current user in a free course.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const slug: string | undefined = body.slug;
  if (!slug) return NextResponse.json({ error: 'slug_required' }, { status: 400 });

  const result = await enrollInCourse(slug);
  if (!result.ok) {
    const status = result.reason === 'unauthenticated' ? 401 : result.reason === 'not_found' ? 404 : result.reason === 'requires_purchase' ? 402 : 500;
    return NextResponse.json({ error: result.reason, message: result.message }, { status });
  }
  return NextResponse.json({ ok: true, alreadyEnrolled: result.alreadyEnrolled });
}

export async function GET() {
  const items = await listMyEnrollments();
  return NextResponse.json({ items });
}
