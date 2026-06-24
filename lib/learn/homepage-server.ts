import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSections, DEFAULT_SECTIONS, type HomepageSection } from './homepage';

/**
 * Read the homepage layout. Returns stored sections when present, otherwise the
 * code-defined defaults — so the homepage and the Studio always have content.
 *
 * Server-only: kept out of lib/learn/homepage.ts so client components (the
 * Studio) can import the shared config/types without pulling in next/headers.
 */
export async function getHomepageConfig(): Promise<HomepageSection[]> {
  try {
    const supa = await createClient();
    const { data } = await supa
      .from('homepage_config')
      .select('sections')
      .eq('id', 1)
      .maybeSingle();
    const sections = sanitizeSections((data as { sections?: unknown } | null)?.sections);
    return sections.length > 0 ? sections : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}
