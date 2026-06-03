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
};

export type Course = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  audience?: string;
  cover?: 'hero' | 'header';
  lastUpdated?: string;
  lessons: Lesson[];
  linkedAgents?: { id: string; title: string; href: string }[];
};

// ============================================================
// V1 (Supabase-backed) types — used by /admin/* and /api/content/*
// ============================================================

export type ContentType = 'course' | 'guide';
export type ContentStatus = 'draft' | 'published';

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
  body: GuideBlock[] | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
  title: string;
  html_content: string;
  audience: string | null;
  created_by: string | null;
  created_at: string;
};

export type Progress = {
  user_id: string;
  lesson_id: string;
  completed_at: string;
};
