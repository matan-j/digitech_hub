/**
 * Lead attribution capture for the Digitech Hub.
 *
 * Reads UTM params + document.referrer + first guide/creator/course touchpoints
 * from the current location and persists them to localStorage so they survive
 * the auth redirect (Google OAuth / magic-link), then can be read back and
 * written to the user's profile once a session exists.
 *
 * First-touch semantics: this module only captures what is present at the
 * moment of capture; the server (POST /api/leads/capture) enforces that
 * first_* touchpoints and registration_source are only set if currently null.
 */

const STORAGE_KEY = 'digitech.lead_attribution.v1';

export type Attribution = {
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  first_guide_touchpoint?: string;
  first_creator_touchpoint?: string;
  first_course_touchpoint?: string;
  registration_source?: string;
};

/** Pending data entered in the AccessModal that must outlive the auth redirect. */
export type PendingProfile = {
  full_name?: string;
  phone?: string;
  marketing_consent?: boolean;
  intended_action?: string;
  return_to?: string;
};

export type PendingLead = Attribution & PendingProfile;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Derive attribution from a path + search + referrer. Pure so it is testable
 * and reusable. `path` is a pathname like `/learn/guides/foo`.
 */
export function deriveAttribution(
  path: string,
  search: string,
  referrer: string,
): Attribution {
  const params = new URLSearchParams(search);
  const attr: Attribution = {};

  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmContent = params.get('utm_content');
  if (utmSource) attr.utm_source = utmSource;
  if (utmMedium) attr.utm_medium = utmMedium;
  if (utmCampaign) attr.utm_campaign = utmCampaign;
  if (utmContent) attr.utm_content = utmContent;

  // Only record external referrers (ignore same-origin navigation).
  if (referrer) {
    try {
      const refHost = new URL(referrer).host;
      const ownHost = isBrowser() ? window.location.host : '';
      if (!ownHost || refHost !== ownHost) attr.referrer = referrer;
    } catch {
      /* malformed referrer — ignore */
    }
  }

  // Touchpoints: the slug/path of the first guide/creator/course seen.
  const guide = matchSlug(path, /\/guides\/([^/?#]+)/);
  if (guide) attr.first_guide_touchpoint = guide;
  const creator = matchSlug(path, /\/creators?\/([^/?#]+)/);
  if (creator) attr.first_creator_touchpoint = creator;
  const course = matchSlug(path, /\/courses\/([^/?#]+)/);
  if (course) attr.first_course_touchpoint = course;

  attr.registration_source = path || '/learn';

  return attr;
}

function matchSlug(path: string, re: RegExp): string | undefined {
  const m = path.match(re);
  return m ? m[1] : undefined;
}

/** Capture attribution from the live browser location (no-op on server). */
export function captureAttribution(): Attribution {
  if (!isBrowser()) return {};
  return deriveAttribution(
    window.location.pathname,
    window.location.search,
    document.referrer || '',
  );
}

/**
 * Merge new pending lead data into whatever is already stored, then persist.
 * Existing non-empty fields win (first-touch), so calling this repeatedly as
 * the user browses does not overwrite the original touchpoints.
 */
export function stashPendingLead(patch: PendingLead): PendingLead {
  if (!isBrowser()) return patch;
  const existing = readPendingLead() ?? {};
  // First-touch: keep existing attribution/touchpoint fields if already set.
  const merged: PendingLead = { ...patch, ...existing };
  // ...but allow the freshest profile fields (name/phone/consent/action) to win.
  for (const key of [
    'full_name',
    'phone',
    'marketing_consent',
    'intended_action',
    'return_to',
  ] as const) {
    if (patch[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = patch[key];
    }
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* storage unavailable / quota — best-effort only */
  }
  return merged;
}

export function readPendingLead(): PendingLead | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingLead;
  } catch {
    return null;
  }
}

export function clearPendingLead(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
