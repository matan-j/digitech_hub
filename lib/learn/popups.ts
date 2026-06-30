// lib/learn/popups.ts
// Shared types + constants for the admin-managed site popups.
// Mirrors the public.popups table from migration 040.

export type PopupContentType = 'image' | 'html' | 'iframe' | 'video' | 'rich_text';
export type PopupTriggerType = 'scroll' | 'time';
export type PopupScope = 'all' | 'page' | 'all_except';

export type Popup = {
  id: string;
  name: string;

  content_type: PopupContentType;
  image_url: string | null;
  image_link: string | null;
  image_link_new_tab: boolean;
  /** When true, clicking the image opens the registration/login modal (ignores image_link). */
  image_link_auth: boolean;
  /** When true, the registration form is docked directly beneath the image (no click needed). */
  image_signup_form: boolean;
  html: string | null;
  iframe_url: string | null;
  video_url: string | null;

  logged_in_only: boolean;
  show_once: boolean;
  enabled: boolean;

  corner_radius: number;
  max_width: number;

  trigger_type: PopupTriggerType;
  trigger_value: number;

  scope: PopupScope;
  target_path: string | null;       // scope = 'page'
  excluded_paths: string[];          // scope = 'all_except'

  priority: number;

  starts_at: string | null;
  ends_at: string | null;

  created_at: string;
  updated_at: string;
};

/** The subset the public renderer needs — never expose admin-only metadata. */
export type PublicPopup = Pick<
  Popup,
  | 'id'
  | 'content_type'
  | 'image_url'
  | 'image_link'
  | 'image_link_new_tab'
  | 'image_link_auth'
  | 'image_signup_form'
  | 'html'
  | 'iframe_url'
  | 'video_url'
  | 'show_once'
  | 'corner_radius'
  | 'max_width'
  | 'trigger_type'
  | 'trigger_value'
  | 'priority'
>;

export const POPUP_CONTENT_TYPES: { value: PopupContentType; label: string }[] = [
  { value: 'image', label: 'תמונה' },
  { value: 'rich_text', label: 'טקסט עשיר' },
  { value: 'html', label: 'HTML' },
  { value: 'iframe', label: 'IFRAME' },
  { value: 'video', label: 'וידאו' },
];

export const POPUP_TRIGGER_TYPES: { value: PopupTriggerType; label: string }[] = [
  { value: 'time', label: 'לפי זמן (שניות)' },
  { value: 'scroll', label: 'לפי גלילה (אחוז)' },
];

export const POPUP_SCOPES: { value: PopupScope; label: string }[] = [
  { value: 'all', label: 'כל האתר' },
  { value: 'page', label: 'עמוד ספציפי' },
  { value: 'all_except', label: 'כל האתר חוץ מ-' },
];

/**
 * Curated list of public pages an admin can target from a dropdown / checklist.
 * Values are exact pathnames (as returned by usePathname). Dynamic pages
 * (a specific course / bundle / guide) aren't listed — for those, the "specific
 * page" mode also accepts a custom path typed by hand.
 */
export const POPUP_PAGES: { value: string; label: string }[] = [
  { value: '/', label: 'דף הבית' },
  { value: '/pricing', label: 'תמחור / מנויים' },
  { value: '/upgrade', label: 'שדרוג' },
  { value: '/learn', label: 'אזור הלמידה — בית' },
  { value: '/learn/bundles', label: 'חבילות' },
  { value: '/learn/courses', label: 'קורסים' },
  { value: '/learn/guides', label: 'מדריכים' },
  { value: '/learn/creators', label: 'יוצרים' },
  { value: '/learn/playbooks', label: 'פלייבוקים' },
  { value: '/learn/playlists', label: 'רשימות השמעה' },
  { value: '/learn/account', label: 'החשבון שלי' },
];

/** Defaults for a brand-new popup in the admin form. */
export const NEW_POPUP_DEFAULTS = {
  name: '',
  content_type: 'image' as PopupContentType,
  image_url: null,
  image_link: null,
  image_link_new_tab: true,
  image_link_auth: false,
  image_signup_form: false,
  html: null,
  iframe_url: null,
  video_url: null,
  logged_in_only: false,
  show_once: false,
  enabled: false,
  corner_radius: 16,
  max_width: 480,
  trigger_type: 'time' as PopupTriggerType,
  trigger_value: 5,
  scope: 'all' as PopupScope,
  target_path: null,
  excluded_paths: [] as string[],
  priority: 0,
  starts_at: null,
  ends_at: null,
};

/** localStorage key used by the renderer to honour "show once". */
export function popupSeenKey(id: string): string {
  return `digitech_popup_seen_${id}`;
}

/** Build the embeddable src for a video url (YouTube / Vimeo / direct file). */
export function popupVideoEmbed(url: string): { kind: 'iframe' | 'file'; src: string } {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  return { kind: 'file', src: u };
}
