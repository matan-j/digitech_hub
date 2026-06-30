// Shared field sanitisation for the popups admin API (POST + PUT).
import type { PopupContentType, PopupScope, PopupTriggerType } from '@/lib/learn/popups';

const CONTENT_TYPES: PopupContentType[] = ['image', 'html', 'iframe', 'video', 'rich_text'];
const TRIGGER_TYPES: PopupTriggerType[] = ['scroll', 'time'];
const SCOPES: PopupScope[] = ['all', 'page', 'all_except'];

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Clean array of non-empty path strings (deduped). */
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.map(str).filter((s): s is string => s !== null);
  return Array.from(new Set(out));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isoOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build a clean column map from a request body. When `partial` is true
 * (PUT), only keys present in the body are returned, so callers can patch
 * a subset; otherwise (POST) every column gets a value with sane defaults.
 */
export function sanitizePopup(body: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const set = (k: string, value: unknown) => {
    if (!partial || has(k)) out[k] = value;
  };

  set('name', str(body.name) ?? '');

  const ct = CONTENT_TYPES.includes(body.content_type as PopupContentType)
    ? (body.content_type as PopupContentType)
    : 'image';
  set('content_type', ct);

  set('image_url', str(body.image_url));
  set('image_link', str(body.image_link));
  set('image_link_new_tab', bool(body.image_link_new_tab, true));
  set('image_link_auth', bool(body.image_link_auth));
  set('image_signup_form', bool(body.image_signup_form));
  set('html', str(body.html));
  set('iframe_url', str(body.iframe_url));
  set('video_url', str(body.video_url));

  set('logged_in_only', bool(body.logged_in_only));
  set('show_once', bool(body.show_once));
  set('enabled', bool(body.enabled));

  set('corner_radius', clampInt(body.corner_radius, 0, 64, 16));
  set('max_width', clampInt(body.max_width, 240, 1280, 480));

  const tt = TRIGGER_TYPES.includes(body.trigger_type as PopupTriggerType)
    ? (body.trigger_type as PopupTriggerType)
    : 'time';
  set('trigger_type', tt);
  set('trigger_value', clampInt(body.trigger_value, 0, 100000, 5));

  const sc = SCOPES.includes(body.scope as PopupScope) ? (body.scope as PopupScope) : 'all';
  set('scope', sc);
  set('target_path', str(body.target_path));
  set('excluded_paths', strArray(body.excluded_paths));

  set('priority', clampInt(body.priority, -1000, 1000, 0));
  set('starts_at', isoOrNull(body.starts_at));
  set('ends_at', isoOrNull(body.ends_at));

  return out;
}
