-- 026_rename_guides_seed_text.sql
-- Align previously-seeded demo content with the "מדריכים → הדרכות" rebrand.
-- The 015 seed inserted Hebrew text containing "מדריכים"/"מדריך"; this updates
-- those specific demo rows in databases that were already seeded.
-- Idempotent and narrowly scoped by slug — safe to re-run.

-- Digitech creator bio: "מדריכים פרקטיים" -> "הדרכות פרקטיות"
update public.creators
set bio = replace(bio, 'מדריכים פרקטיים', 'הדרכות פרקטיות')
where slug = 'digitech'
  and bio like '%מדריכים פרקטיים%';

-- "Claude Design – Getting Started" guide description:
-- "מדריך וידאו קצר" -> "הדרכת וידאו קצרה"
update public.content_items
set description = replace(description, 'מדריך וידאו קצר', 'הדרכת וידאו קצרה')
where type = 'guide'
  and slug = 'claude-design-getting-started'
  and description like '%מדריך וידאו קצר%';
