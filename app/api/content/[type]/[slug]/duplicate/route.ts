import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteActor } from '@/lib/learn/content-write';
import { getCourseWithModules } from '@/lib/learn/db';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ type: string; slug: string }> },
) {
  const actor = await resolveWriteActor();
  if (actor.kind !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { type, slug } = await ctx.params;
  if (type !== 'course') {
    return NextResponse.json({ error: 'only_courses_supported' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch the full course tree
  const source = await getCourseWithModules(slug);
  if (!source) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Determine a unique new slug
  const baseSlug = `${source.slug}-copy`;
  let newSlug = baseSlug;
  for (let n = 2; n < 50; n++) {
    const { count } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'course')
      .eq('slug', newSlug);
    if ((count ?? 0) === 0) break;
    newSlug = `${baseSlug}-${n}`;
  }

  // Insert the new content_item (always draft)
  const {
    id: _oldId, slug: _oldSlug, created_at: _ca, updated_at: _ua,
    published_at: _pa, created_by: _cb, updated_by: _ub,
    modules: _mods, categories: _cats,
    ...rest
  } = source as typeof source & { modules: unknown; categories: unknown };

  const { data: newItem, error: itemErr } = await supabase
    .from('content_items')
    .insert({
      ...rest,
      slug: newSlug,
      title: `${source.title} (עותק)`,
      status: 'draft',
      published_at: null,
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .select('id')
    .single();

  if (itemErr || !newItem) {
    console.error('[duplicate:item]', itemErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const newCourseId = newItem.id as string;

  // Copy categories
  const { data: catLinks } = await supabase
    .from('content_item_categories')
    .select('category_id')
    .eq('content_item_id', source.id);

  if (catLinks && catLinks.length > 0) {
    await supabase.from('content_item_categories').insert(
      catLinks.map((r: { category_id: string }) => ({
        content_item_id: newCourseId,
        category_id: r.category_id,
      })),
    );
  }

  // Deep-copy modules → chapters → lessons → resources
  for (const mod of source.modules) {
    // Strip nested children (chapters/lessons/resources) + id/course_id: they are
    // enriched in-memory shapes, NOT columns on `modules`. Leaving them in the spread
    // makes Supabase reject the insert on unknown columns, silently skipping the module.
    const {
      id: oldModId, course_id: _cid,
      chapters: _modChapters, lessons: _modLessons, resources: _modResources,
      ...modRest
    } = mod as typeof mod & { course_id: string };

    const { data: newMod, error: modErr } = await supabase
      .from('modules')
      .insert({ ...modRest, course_id: newCourseId })
      .select('id')
      .single();

    if (modErr || !newMod) {
      console.error('[duplicate:module]', modErr);
      continue;
    }

    const newModId = newMod.id as string;

    // Copy module-level resources
    const modResources = (mod.resources ?? []).map(({ id: _rid, owner_id: _oid, ...r }: { id: string; owner_id: string; [k: string]: unknown }) => ({
      ...r,
      owner_id: newModId,
    }));
    if (modResources.length > 0) {
      await supabase.from('resources').insert(modResources);
    }

    // Copy chapters
    for (const ch of mod.chapters ?? []) {
      // Same as modules: drop nested lessons/resources so the chapters insert only
      // carries real columns.
      const {
        id: oldChId, module_id: _mid,
        lessons: _chLessons, resources: _chResources,
        ...chRest
      } = ch as typeof ch & { module_id: string };

      const { data: newCh, error: chErr } = await supabase
        .from('chapters')
        .insert({ ...chRest, module_id: newModId })
        .select('id')
        .single();

      if (chErr || !newCh) {
        console.error('[duplicate:chapter]', chErr);
        continue;
      }

      const newChId = newCh.id as string;

      // Chapter resources
      const chResources = (ch.resources ?? []).map(({ id: _rid, owner_id: _oid, ...r }: { id: string; owner_id: string; [k: string]: unknown }) => ({
        ...r,
        owner_id: newChId,
      }));
      if (chResources.length > 0) {
        await supabase.from('resources').insert(chResources);
      }

      // Chapter lessons
      for (const lesson of ch.lessons ?? []) {
        const { id: _lid, course_id: _lcid, module_id: _lmid, chapter_id: _lchid, resources: lessonRes, ...lessonRest } = lesson as typeof lesson & { course_id: string; module_id: string; chapter_id: string; resources: { id: string; owner_id: string; [k: string]: unknown }[] };

        const { data: newLesson, error: lessonErr } = await supabase
          .from('lessons')
          .insert({
            ...lessonRest,
            course_id: newCourseId,
            module_id: newModId,
            chapter_id: newChId,
          })
          .select('id')
          .single();

        if (lessonErr || !newLesson) {
          console.error('[duplicate:lesson]', lessonErr);
          continue;
        }

        const lessonResources = (lessonRes ?? []).map(({ id: _rid, owner_id: _oid, ...r }) => ({
          ...r,
          owner_id: newLesson.id,
        }));
        if (lessonResources.length > 0) {
          await supabase.from('resources').insert(lessonResources);
        }
      }
    }

    // Module-direct lessons (no chapter)
    for (const lesson of mod.lessons ?? []) {
      const { id: _lid, course_id: _lcid, module_id: _lmid, chapter_id: _lchid, resources: lessonRes, ...lessonRest } = lesson as typeof lesson & { course_id: string; module_id: string; chapter_id: string | null; resources: { id: string; owner_id: string; [k: string]: unknown }[] };

      const { data: newLesson, error: lessonErr } = await supabase
        .from('lessons')
        .insert({
          ...lessonRest,
          course_id: newCourseId,
          module_id: newModId,
          chapter_id: null,
        })
        .select('id')
        .single();

      if (lessonErr || !newLesson) {
        console.error('[duplicate:lesson:direct]', lessonErr);
        continue;
      }

      const lessonResources = (lessonRes ?? []).map(({ id: _rid, owner_id: _oid, ...r }) => ({
        ...r,
        owner_id: newLesson.id,
      }));
      if (lessonResources.length > 0) {
        await supabase.from('resources').insert(lessonResources);
      }
    }

    void oldModId;
  }

  return NextResponse.json({ slug: newSlug });
}
