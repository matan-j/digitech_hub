// ============================================================
// Homepage Studio — config model (migration 023)
// ------------------------------------------------------------
// Client-safe: shared constants, types and pure validators only.
// The server-only reader lives in lib/learn/homepage-server.ts so
// the client Studio can import this module without next/headers.
// ============================================================

export const HOMEPAGE_SECTION_TYPES = [
  'hero',
  'value_props',
  'featured_courses',
  'featured_guides',
  'featured_creators',
  'featured_playlists',
  'cta_band',
] as const;

export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];

export type HomepageSection = {
  /** Stable unique id within the config (used as React key + dedupe). */
  key: string;
  type: HomepageSectionType;
  enabled: boolean;
  /** Heading override. null/empty → component default. */
  title?: string | null;
  /** Sub-heading / body copy (hero, cta_band, value-props intro). */
  subtitle?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  /** Item cap for content sections (featured_*). */
  limit?: number | null;
};

/** Human labels for the Studio UI + whether each type takes copy / a limit. */
export const SECTION_META: Record<
  HomepageSectionType,
  { label: string; hasCopy: boolean; hasCta: boolean; hasLimit: boolean }
> = {
  hero: { label: 'כותרת ראשית (Hero)', hasCopy: true, hasCta: true, hasLimit: false },
  value_props: { label: 'יתרונות', hasCopy: false, hasCta: false, hasLimit: false },
  featured_courses: { label: 'קורסים נבחרים', hasCopy: true, hasCta: true, hasLimit: true },
  featured_guides: { label: 'הדרכות נבחרות', hasCopy: true, hasCta: true, hasLimit: true },
  featured_creators: { label: 'יוצרים מובילים', hasCopy: true, hasCta: true, hasLimit: true },
  featured_playlists: { label: 'פלייליסטים נבחרים', hasCopy: true, hasCta: true, hasLimit: true },
  cta_band: { label: 'באנר קריאה לפעולה', hasCopy: true, hasCta: true, hasLimit: false },
};

const LIMIT_MIN = 1;
const LIMIT_MAX = 24;

/**
 * Code-defined default layout — mirrors the original hardcoded homepage so the
 * page renders identically before any admin edit. Also what the Studio shows on
 * a fresh install and what "reset to defaults" restores.
 */
export const DEFAULT_SECTIONS: HomepageSection[] = [
  {
    key: 'hero',
    type: 'hero',
    enabled: true,
    title: 'לומדים את מה שבאמת עובד',
    subtitle:
      'קורסים, הדרכות ופלייבוקים מהיוצרים המובילים בישראל. גלו, צפו והתחילו ללמוד — בלי הרשמה, בלי חסמים.',
    cta_label: 'עיון בקורסים',
    cta_href: '/learn/courses',
  },
  { key: 'value_props', type: 'value_props', enabled: true },
  {
    key: 'featured_courses',
    type: 'featured_courses',
    enabled: true,
    title: 'קורסים נבחרים',
    cta_label: 'כל הקורסים',
    cta_href: '/learn/courses',
    limit: 3,
  },
  {
    key: 'featured_guides',
    type: 'featured_guides',
    enabled: true,
    title: 'הדרכות אחרונות',
    cta_label: 'כל ההדרכות',
    cta_href: '/learn/guides',
    limit: 6,
  },
  {
    key: 'featured_creators',
    type: 'featured_creators',
    enabled: true,
    title: 'יוצרים מובילים',
    cta_label: 'כל היוצרים',
    cta_href: '/learn/creators',
    limit: 8,
  },
  {
    key: 'featured_playlists',
    type: 'featured_playlists',
    enabled: false,
    title: 'פלייליסטים נבחרים',
    cta_label: 'כל הפלייליסטים',
    cta_href: '/learn/playlists',
    limit: 6,
  },
  {
    key: 'cta_band',
    type: 'cta_band',
    enabled: true,
    title: 'מוכנים להעמיק?',
    subtitle: 'הצטרפו למועדון לגישה מלאה לקורסים, מעקב התקדמות וחומרי עבודה להורדה.',
    cta_label: 'צפו במסלולים',
    cta_href: '/pricing',
  },
];

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validate + normalize an untrusted sections array (from the DB or an admin PUT).
 * Drops entries with unknown types, coerces fields, clamps limits, and dedupes
 * keys. Returns a clean array; an empty result means "use defaults".
 */
export function sanitizeSections(input: unknown): HomepageSection[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: HomepageSection[] = [];

  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') continue;
    const type = raw.type as HomepageSectionType;
    if (!HOMEPAGE_SECTION_TYPES.includes(type)) continue;

    let key = str(raw.key) ?? type;
    while (seen.has(key)) key = `${key}-${i}`;
    seen.add(key);

    const meta = SECTION_META[type];
    const section: HomepageSection = {
      key,
      type,
      enabled: raw.enabled !== false, // default true
    };
    if (meta.hasCopy) {
      section.title = str(raw.title);
      section.subtitle = str(raw.subtitle);
    } else if (str(raw.title)) {
      section.title = str(raw.title);
    }
    if (meta.hasCta) {
      section.cta_label = str(raw.cta_label);
      section.cta_href = str(raw.cta_href);
    }
    if (meta.hasLimit) {
      const n = Math.round(Number(raw.limit));
      section.limit = Number.isFinite(n) ? Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, n)) : null;
    }
    out.push(section);
  }
  return out;
}
