-- 015_seed_creators_demo.sql
-- Idempotent demo content for the Creator Hub. Safe to re-run.

-- ============================================================
-- 1. Creators
-- ============================================================

insert into public.creators (slug, name, bio, role_title, is_featured, sort_order, website, youtube, instagram, linkedin)
values
  ('matan-jacobson', 'Matan Jacobson',
   'מומחה AI, שיווק וצמיחה עסקית. בונה כלים ומלמד עסקים איך למנף בינה מלאכותית.',
   'CEO, Digitech & EDDI', true, 10,
   'https://digi-tech.co.il', 'https://youtube.com/@matanjacobson', 'https://instagram.com/', 'https://linkedin.com/'),
  ('digitech', 'Digitech',
   'בית התוכן של Digitech — הדרכות פרקטיות, קורסים וכלים ללמידה עצמאית.',
   'Digitech Learning Hub', true, 20,
   'https://digi-tech.co.il', 'https://youtube.com/', null, null)
on conflict (slug) do nothing;

-- Link the Matan creator to his platform profile if it exists.
update public.creators c
set user_id = p.id
from public.profiles p
join auth.users u on u.id = p.id
where c.slug = 'matan-jacobson'
  and c.user_id is null
  and u.email = 'matan@digi-tech.co.il';

-- ============================================================
-- 2. Playlists
-- ============================================================

insert into public.playlists (creator_id, slug, title, description, domain, status, is_featured, sort_order, published_at)
select c.id, 'claude-design', 'Claude Design',
       'איך לבנות ממשקים ומוצרים יפים בעזרת Claude.', 'design', 'published', true, 10, now()
from public.creators c where c.slug = 'matan-jacobson'
on conflict (creator_id, slug) do nothing;

insert into public.playlists (creator_id, slug, title, description, domain, status, is_featured, sort_order, published_at)
select c.id, 'ai-tools-for-beginners', 'AI Tools For Beginners',
       'כלי הבינה המלאכותית החשובים — מאפס למתקדם.', 'ai', 'published', true, 20, now()
from public.creators c where c.slug = 'digitech'
on conflict (creator_id, slug) do nothing;

-- ============================================================
-- 3. Guides (content_items, type='guide')
-- ============================================================

insert into public.content_items
  (type, slug, title, tagline, description, status, is_premium, is_featured, domain,
   content_kind, content_url, video_url, body, creator_id, published_at)
select 'guide', 'claude-design-getting-started', 'Claude Design – Getting Started',
       'מתחילים לעצב עם Claude — צעד אחר צעד.',
       'הדרכת וידאו קצרה שמראה איך להתחיל לעצב ממשקים בעזרת Claude.',
       'published', false, true, 'design',
       'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
       '[]'::jsonb, c.id, now()
from public.creators c where c.slug = 'matan-jacobson'
on conflict (type, slug) do nothing;

insert into public.content_items
  (type, slug, title, tagline, description, status, is_premium, is_featured, domain,
   content_kind, body, creator_id, published_at)
select 'guide', 'building-better-prompts', 'Building Better Prompts',
       'הנדסת פרומפטים — איך לקבל תוצאות טובות יותר.',
       'מאמר פרקטי על כתיבת פרומפטים אפקטיביים.',
       'published', false, true, 'ai',
       'article',
       '[{"type":"markdown","content":"## מה הופך פרומפט לטוב?\n\nפרומפט טוב הוא ברור, ממוקד ונותן הקשר. בהמשך נראה דוגמאות."}]'::jsonb,
       c.id, now()
from public.creators c where c.slug = 'digitech'
on conflict (type, slug) do nothing;

insert into public.content_items
  (type, slug, title, tagline, description, status, is_premium, domain,
   content_kind, content_url, body, creator_id, published_at)
select 'guide', 'ai-tools-for-teachers', 'AI Tools For Teachers',
       'כלי AI שכל מורה צריך להכיר.',
       'רשימת כלים חיצונית עם המלצות שימוש לכיתה.',
       'published', false, 'ai',
       'link', 'https://digi-tech.co.il',
       '[]'::jsonb, c.id, now()
from public.creators c where c.slug = 'digitech'
on conflict (type, slug) do nothing;

-- ============================================================
-- 4. Attach guides to playlists (ordered)
-- ============================================================

insert into public.playlist_items (playlist_id, content_item_id, sort_order)
select pl.id, ci.id, 10
from public.playlists pl
join public.creators c on c.id = pl.creator_id and c.slug = 'matan-jacobson'
join public.content_items ci on ci.slug = 'claude-design-getting-started'
where pl.slug = 'claude-design'
on conflict (playlist_id, content_item_id) do nothing;

insert into public.playlist_items (playlist_id, content_item_id, sort_order)
select pl.id, ci.id, 10
from public.playlists pl
join public.creators c on c.id = pl.creator_id and c.slug = 'digitech'
join public.content_items ci on ci.slug in ('building-better-prompts','ai-tools-for-teachers')
where pl.slug = 'ai-tools-for-beginners'
on conflict (playlist_id, content_item_id) do nothing;
