-- 012_modules_chapters.sql
-- Adds a Module (יחידת לימוד) + optional Chapter (פרק) hierarchy above lessons.
-- After this migration every existing course has a default "מודול 1" with all
-- of its previous lessons re-parented into it.
--
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. modules
-- ============================================================
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.content_items(id) on delete cascade,
  num int not null,
  slug text not null,
  title text not null,
  vimeo_id text,
  duration text,
  body text,
  position int not null,
  created_at timestamptz not null default now(),
  unique (course_id, slug)
);

create index if not exists modules_course_position_idx on public.modules(course_id, position);

-- ============================================================
-- 2. chapters
-- ============================================================
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  num int not null,
  slug text not null,
  title text not null,
  vimeo_id text,
  duration text,
  body text,
  position int not null,
  created_at timestamptz not null default now(),
  unique (module_id, slug)
);

create index if not exists chapters_module_position_idx on public.chapters(module_id, position);

-- ============================================================
-- 3. Backfill: default "מודול 1" for every existing course
-- ============================================================
insert into public.modules (course_id, num, slug, title, position)
select id, 1, 'module-1', 'מודול 1', 0
from public.content_items
where type = 'course'
on conflict (course_id, slug) do nothing;

-- ============================================================
-- 4. Extend lessons with module_id (NOT NULL) + chapter_id (NULLABLE)
-- ============================================================
alter table public.lessons
  add column if not exists module_id uuid references public.modules(id) on delete cascade;

alter table public.lessons
  add column if not exists chapter_id uuid references public.chapters(id) on delete cascade;

-- Backfill every existing lesson into its course's default "module-1"
update public.lessons l
set module_id = m.id
from public.modules m
where m.course_id = l.course_id
  and m.slug = 'module-1'
  and l.module_id is null;

-- Now safe to enforce NOT NULL
alter table public.lessons
  alter column module_id set not null;

-- Safety net against intra-module slug collisions after drag-drop.
-- The existing UNIQUE(course_id, slug) stays — that's the routing key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lessons_module_id_slug_key'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons add constraint lessons_module_id_slug_key unique (module_id, slug);
  end if;
end $$;

create index if not exists lessons_module_position_idx on public.lessons(module_id, position);

-- ============================================================
-- 5. Resources polymorphism — allow owner_type 'module' / 'chapter'
-- ============================================================
alter table public.resources drop constraint if exists resources_owner_type_check;
alter table public.resources add constraint resources_owner_type_check
  check (owner_type in ('lesson', 'content_item', 'module', 'chapter'));

-- ============================================================
-- 6. RLS for modules + chapters (mirror lessons_select / lessons_admin_write)
-- ============================================================
alter table public.modules enable row level security;

drop policy if exists "modules_select" on public.modules;
create policy "modules_select"
  on public.modules for select
  using (public.can_view_content_item(course_id));

drop policy if exists "modules_admin_write" on public.modules;
create policy "modules_admin_write"
  on public.modules for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.chapters enable row level security;

drop policy if exists "chapters_select" on public.chapters;
create policy "chapters_select"
  on public.chapters for select
  using (
    exists (
      select 1 from public.modules m
      where m.id = chapters.module_id
        and public.can_view_content_item(m.course_id)
    )
  );

drop policy if exists "chapters_admin_write" on public.chapters;
create policy "chapters_admin_write"
  on public.chapters for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 7. Extend resources_select to handle 'module' and 'chapter' owner_types
--    (without this, downloads on module/chapter attachments would silently 403)
-- ============================================================
drop policy if exists "resources_select" on public.resources;
create policy "resources_select"
  on public.resources for select
  using (
    case owner_type
      when 'content_item' then public.can_view_content_item(owner_id)
      when 'lesson' then exists (
        select 1 from public.lessons l
        where l.id = owner_id and public.can_view_content_item(l.course_id)
      )
      when 'module' then exists (
        select 1 from public.modules m
        where m.id = owner_id and public.can_view_content_item(m.course_id)
      )
      when 'chapter' then exists (
        select 1 from public.chapters c
        join public.modules m on m.id = c.module_id
        where c.id = owner_id and public.can_view_content_item(m.course_id)
      )
      else false
    end
  );
