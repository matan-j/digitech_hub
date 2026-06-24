// ============================================================
// LEGACY types — used by the existing filesystem-backed admin
// (lib/learn/storage.ts, /learn-admin/*). Kept until migration
// to Postgres is fully cut over.
// ============================================================

export type Resource = {
  id: string;
  title: string;
  url: string;
  sizeMB?: number;
  kind?: 'pdf' | 'xlsx' | 'docx' | 'link';
};

export type Lesson = {
  num: number;
  slug: string;
  title: string;
  vimeoId: string;
  duration: string;
  body: string;
  resources?: Resource[];
  /** True when the lesson is hard-locked (migration 031) by its module, chapter, or itself — blocked for everyone. */
  locked?: boolean;
};

export type Course = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  audience?: string;
  cover?: 'hero' | 'header';
  /** Explicit cover image URL; when set, CourseCard renders it over the gradient. */
  coverUrl?: string | null;
  lastUpdated?: string;
  lessons: Lesson[];
  linkedAgents?: { id: string; title: string; href: string }[];
};

// ============================================================
// V1 (Supabase-backed) types — used by /admin/* and /api/content/*
// ============================================================

export type ContentType = 'course' | 'guide';
export type ContentStatus = 'draft' | 'published' | 'archived';

// ----- Public-first access model (migration 018) -----
/** Controls listing/discovery only — never gates body access. */
export type CatalogVisibility = 'public' | 'unlisted';
/**
 * Gates the full body (app + RLS enforced).
 *   open                  — full content public; login only for high-intent actions.
 *   login_required        — metadata public; body needs login; preview iff enabled.
 *   purchase_required     — metadata public; body needs an active entitlement.
 *   subscription_required — metadata public; body needs an active subscription.
 */
export type AccessLevel = 'open' | 'login_required' | 'purchase_required' | 'subscription_required';

/** Guide content type — how the guide body is delivered. */
export type GuideContentKind = 'youtube' | 'vimeo' | 'pdf' | 'link' | 'article';
export const GUIDE_CONTENT_KINDS: GuideContentKind[] = ['youtube', 'vimeo', 'pdf', 'link', 'article'];

export type DbResource = {
  id: string;
  owner_type: 'lesson' | 'content_item';
  owner_id: string;
  title: string;
  url: string;
  size_mb: number | null;
  kind: 'pdf' | 'xlsx' | 'docx' | 'link' | null;
};

export type DbLesson = {
  id: string;
  course_id: string;
  module_id: string;
  chapter_id: string | null;
  num: number;
  slug: string;
  title: string;
  vimeo_id: string | null;
  duration: string | null;
  body: string | null;
  position: number;
  /** Free preview lesson inside an otherwise gated course (migration 018). */
  is_preview?: boolean;
  /** Hard lock on this single lesson (migration 031): blocks just this lesson for EVERYONE. */
  is_locked?: boolean;
  /** Derived (not a column): effective hard lock = module OR chapter OR lesson is_locked. Stamped by getCourseWithLessons. */
  hard_locked?: boolean;
  resources?: DbResource[];
};

export type DbModule = {
  id: string;
  course_id: string;
  num: number;
  slug: string;
  title: string;
  vimeo_id: string | null;
  duration: string | null;
  body: string | null;
  position: number;
  /** Hard lock (migration 031): when true the module + all its chapters/lessons are blocked for EVERYONE. */
  is_locked?: boolean;
  resources?: DbResource[];
};

export type DbChapter = {
  id: string;
  module_id: string;
  num: number;
  slug: string;
  title: string;
  vimeo_id: string | null;
  duration: string | null;
  body: string | null;
  position: number;
  /** Hard lock (migration 028): when true the chapter + its lessons are blocked for EVERYONE. */
  is_locked?: boolean;
  resources?: DbResource[];
};

export type ChapterWithLessons = DbChapter & { lessons: DbLesson[] };

export type ModuleWithChildren = DbModule & {
  chapters: ChapterWithLessons[];
  lessons: DbLesson[]; // lessons whose chapter_id IS NULL (hang directly under module)
};

export type GuideBlock =
  | { type: 'markdown'; content: string }
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'video'; vimeoId?: string; youtubeId?: string; caption?: string }
  | { type: 'callout'; tone?: 'info' | 'success' | 'warning'; content: string };

import type { DomainId, Category } from './domains';

export type CategoryRef = Pick<Category, 'id' | 'slug' | 'name' | 'domain'>;

export type ContentItem = {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  cover_url: string | null;
  cover_style: 'hero' | 'header';
  audience: string | null;
  tags: string[];
  status: ContentStatus;
  is_premium: boolean;
  // ----- Access model (migration 018) -----
  catalog_visibility: CatalogVisibility;
  access_level: AccessLevel;
  /** Show a limited public preview when access_level gates the body. */
  preview_enabled: boolean;
  /** Price in price_currency for purchase_required items (null = not for sale). */
  price_amount: number | null;
  /** Discounted price (migration 024). When set & below price_amount it is the final price. */
  sale_amount: number | null;
  price_currency: string;
  body: GuideBlock[] | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** YouTube/Vimeo full URL — optional headline video for the item. */
  video_url: string | null;
  /** Fixed-enum top-level classifier. NULL means unclassified. */
  domain: DomainId | null;
  /** Categories joined via content_item_categories. Empty array if none. */
  categories?: CategoryRef[];
  // ----- Creator Hub additions (guides) -----
  /** Owning creator (null for legacy/admin-only content). */
  creator_id: string | null;
  /** How a guide delivers its content. NULL → treated as 'article'. */
  content_kind: GuideContentKind | null;
  /** The primary content URL for youtube/vimeo/pdf/link kinds. */
  content_url: string | null;
  /** Estimated reading/watching time in minutes. */
  duration_minutes: number | null;
  /** Admin-controlled: surfaces the guide in the Featured section. */
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  updated_by: string | null;
  /** Joined creator summary (when fetched with creator). */
  creator?: CreatorRef | null;
};

// ============================================================
// Creator Hub types
// ============================================================

export type CreatorStatus = 'active' | 'disabled';

export type Creator = {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  role_title: string | null;
  /** Optional "Meet the Creator" intro video URL (YouTube/Vimeo/video). */
  intro_video_url: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  /** Public-facing email shown on the creator profile. */
  email: string | null;
  /** Internal support/contact email (not necessarily public). */
  contact_email: string | null;
  user_id: string | null;
  status: CreatorStatus;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Lightweight creator summary embedded on guide/playlist cards. */
export type CreatorRef = Pick<
  Creator,
  'id' | 'slug' | 'name' | 'avatar_url' | 'role_title' | 'website' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok' | 'email'
>;

export type Playlist = {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  domain: DomainId | null;
  status: ContentStatus;
  /** Controls discovery only (migration 018). */
  catalog_visibility: CatalogVisibility;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: CreatorRef | null;
};

export type PlaylistItem = {
  playlist_id: string;
  content_item_id: string;
  sort_order: number;
};

/** Aggregate counts shown on creator cards / dashboards. */
export type CreatorStats = {
  guides: number;
  playlists: number;
  views: number;
};

/** @deprecated use CourseWithModules for new code; this stays for legacy callers (bulk-import, playbooks, courses.ts shim). */
export type CourseWithLessons = ContentItem & {
  type: 'course';
  lessons: DbLesson[];
};

export type CourseWithModules = ContentItem & {
  type: 'course';
  modules: ModuleWithChildren[];
};

export type GuideItem = ContentItem & {
  type: 'guide';
  body: GuideBlock[];
};

export type PlaybookSourceType = 'course' | 'video' | 'manual';

export type Playbook = {
  id: string;
  source_type: PlaybookSourceType;
  source_id: string | null;
  slug: string | null;
  title: string;
  tagline: string | null;
  description: string | null;
  html_content: string;
  audience: string | null;
  cover_url: string | null;
  cover_style: 'hero' | 'header' | null;
  video_url: string | null;
  domain: DomainId | null;
  tags: string[];
  status: ContentStatus;
  is_premium: boolean;
  // ----- Access model (migration 018) -----
  catalog_visibility: CatalogVisibility;
  access_level: AccessLevel;
  preview_enabled: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  categories?: CategoryRef[];
};

export type Progress = {
  user_id: string;
  lesson_id: string;
  completed_at: string;
};
