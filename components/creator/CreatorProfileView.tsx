'use client';

import { useRef, useState } from 'react';
import {
  BookOpen, ListVideo, Eye, Globe, PlayCircle, Link2, Share2, Check, Sparkles,
} from 'lucide-react';
import SocialLinks from '@/components/learn/SocialLinks';
import GuideCard from '@/components/learn/GuideCard';
import PlaylistCard from '@/components/learn/PlaylistCard';
import VimeoPlayer from '@/components/learn/VimeoPlayer';
import EmptyState from '@/components/learn/EmptyState';
import type { Creator, ContentItem, Playlist, CreatorStats } from '@/lib/learn/types';

export type IntroVideo =
  | { type: 'youtube'; embedUrl: string }
  | { type: 'vimeo'; id: string }
  | { type: 'other'; url: string };

export type ProfileTopic = { id: string; label: string };

type Props = {
  creator: Creator;
  stats: CreatorStats;
  guides: ContentItem[];
  playlists: Playlist[];
  playlistCounts: Record<string, number>;
  topics: ProfileTopic[];
  introVideo: IntroVideo | null;
};

type TabId = 'overview' | 'guides' | 'playlists' | 'about';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'ראשי' },
  { id: 'guides', label: 'הדרכות' },
  { id: 'playlists', label: 'פלייליסטים' },
  { id: 'about', label: 'אודות' },
];

function Stat({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-purple-600" />
      <span className="font-extrabold text-neutral-950" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{value}</span>
      <span className="text-sm text-neutral-500">{label}</span>
    </div>
  );
}

function IntroVideoFrame({ video, title }: { video: IntroVideo; title: string }) {
  if (video.type === 'vimeo') return <VimeoPlayer vimeoId={video.id} title={title} />;
  if (video.type === 'youtube') {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden border border-neutral-200 bg-black">
        <iframe
          src={video.embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
    >
      <PlayCircle className="w-4 h-4" /> צפו בסרטון ההיכרות
    </a>
  );
}

export default function CreatorProfileView({
  creator, stats, guides, playlists, playlistCounts, topics, introVideo,
}: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLDivElement | null>(null);

  const featuredPlaylists = (playlists.filter((p) => p.is_featured).length > 0
    ? playlists.filter((p) => p.is_featured)
    : playlists
  ).slice(0, 3);
  const latestGuides = guides.slice(0, 6);

  function goWatchIntro() {
    setTab('overview');
    requestAnimationFrame(() => videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  async function shareProfile() {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: creator.name, text: creator.bio ?? creator.name, url });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    copyLink();
  }

  const heroStyle = creator.banner_url
    ? { backgroundImage: `url(${creator.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: 'linear-gradient(120deg, #1A0F3D 0%, #2E1A5C 55%, #4B2E83 100%)' };

  return (
    <div>
      {/* ───────── Hero ───────── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" style={heroStyle} aria-hidden />
        {creator.banner_url && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(120deg, rgba(26,15,61,0.90), rgba(75,46,131,0.72))' }}
            aria-hidden
          />
        )}
        <div className="relative px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto py-9 sm:py-12">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-start gap-5 sm:gap-6">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center text-4xl font-extrabold overflow-hidden border-4 border-white shrink-0"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {creator.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                creator.name.charAt(0)
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{creator.name}</h1>
              {creator.role_title && <p className="text-sm text-white/70 mt-1">{creator.role_title}</p>}
              {creator.bio && (
                <p className="text-sm text-white/80 mt-2 leading-relaxed max-w-xl line-clamp-2 mx-auto sm:mx-0">
                  {creator.bio}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center sm:items-end gap-3 shrink-0">
              <SocialLinks socials={creator} tone="light" />
              <div className="flex flex-wrap items-center justify-center gap-2">
                {creator.website && (
                  <a
                    href={/^https?:\/\//i.test(creator.website) ? creator.website : `https://${creator.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-white text-brand-purple-700 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Globe className="w-4 h-4" /> לאתר האישי
                  </a>
                )}
                {introVideo && (
                  <button
                    type="button"
                    onClick={goWatchIntro}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill border border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" /> צפו בהיכרות
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ───────── Stats strip ───────── */}
      <div className="bg-white border-b border-neutral-200">
        <div className="px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto py-4 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Stat icon={BookOpen} value={stats.guides} label="הדרכות" />
          <Stat icon={ListVideo} value={stats.playlists} label="פלייליסטים" />
          <Stat icon={Eye} value={stats.views} label="צפיות" />
        </div>
      </div>

      {/* ───────── Tabs ───────── */}
      <div className="bg-white border-b border-neutral-200">
        <div className="px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto">
          <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="ניווט פרופיל">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={[
                    'relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors',
                    active ? 'text-brand-purple-700' : 'text-neutral-500 hover:text-neutral-800',
                  ].join(' ')}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-purple-700" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ───────── Tab content ───────── */}
      <div className="px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto py-8 space-y-10">
        {tab === 'overview' && (
          <>
            {introVideo && (
              <section ref={videoRef}>
                <h2 className="text-lg font-extrabold text-neutral-950 mb-4 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-brand-purple-700" /> הכירו את היוצר
                </h2>
                <IntroVideoFrame video={introVideo} title={`היכרות עם ${creator.name}`} />
              </section>
            )}

            {creator.bio && (
              <section>
                <h2 className="text-lg font-extrabold text-neutral-950 mb-3">אודות</h2>
                <p className="text-neutral-700 leading-relaxed max-w-2xl whitespace-pre-line">{creator.bio}</p>
              </section>
            )}

            {featuredPlaylists.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold text-neutral-950 mb-4">פלייליסטים מומלצים</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featuredPlaylists.map((p) => (
                    <PlaylistCard key={p.id} playlist={p} count={playlistCounts[p.id] ?? 0} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-extrabold text-neutral-950 mb-4">הדרכות אחרונות</h2>
              {latestGuides.length === 0 ? (
                <EmptyState icon={BookOpen} title="עדיין אין הדרכות ליוצר הזה" message="בקרוב יתווסף כאן תוכן חדש." compact />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {latestGuides.map((g) => (
                    <GuideCard key={g.id} guide={g} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'guides' && (
          <section>
            <h2 className="text-lg font-extrabold text-neutral-950 mb-4">כל ההדרכות</h2>
            {guides.length === 0 ? (
              <EmptyState icon={BookOpen} title="עדיין אין הדרכות ליוצר הזה" message="בקרוב יתווסף כאן תוכן חדש." compact />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {guides.map((g) => (
                  <GuideCard key={g.id} guide={g} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'playlists' && (
          <section>
            <h2 className="text-lg font-extrabold text-neutral-950 mb-4">כל הפלייליסטים</h2>
            {playlists.length === 0 ? (
              <EmptyState icon={ListVideo} title="עדיין אין פלייליסטים" compact />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {playlists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} count={playlistCounts[p.id] ?? 0} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'about' && (
          <div className="space-y-10 max-w-2xl">
            <section>
              <h2 className="text-lg font-extrabold text-neutral-950 mb-3">אודות היוצר</h2>
              {creator.bio ? (
                <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{creator.bio}</p>
              ) : (
                <p className="text-neutral-400">אין עדיין תיאור ליוצר זה.</p>
              )}
            </section>

            {topics.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold text-neutral-950 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-purple-700" /> תחומים
                </h2>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <span key={t.id} className="inline-flex items-center px-3 py-1.5 rounded-pill text-xs font-semibold bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-100">
                      {t.label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-extrabold text-neutral-950 mb-3">שיתוף</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-signal" /> : <Link2 className="w-4 h-4" />}
                  {copied ? 'הקישור הועתק' : 'העתקת קישור'}
                </button>
                <button
                  type="button"
                  onClick={shareProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 text-sm font-semibold transition-colors"
                >
                  <Share2 className="w-4 h-4" /> שיתוף פרופיל
                </button>
                {creator.website && (
                  <a
                    href={/^https?:\/\//i.test(creator.website) ? creator.website : `https://${creator.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Globe className="w-4 h-4" /> לאתר האישי
                  </a>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
