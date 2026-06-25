import Link from 'next/link';
import { Compass, BookText, Lock, Play } from 'lucide-react';
import { DOMAIN_BY_ID, domainBadgeClasses, type DomainId } from '@/lib/learn/domains';
import { youtubeIdFromUrl, youtubeThumbnailUrl } from '@/lib/learn/youtube';

type Props = {
  href: string;
  variant: 'guide' | 'playbook';
  title: string;
  tagline: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  domain: DomainId | null;
  locked?: boolean;
};

export default function LearnCard({
  href,
  variant,
  title,
  tagline,
  coverUrl,
  videoUrl,
  domain,
  locked,
}: Props) {
  const ytId = youtubeIdFromUrl(videoUrl);
  const cover = coverUrl || (ytId ? youtubeThumbnailUrl(ytId, 'hq') : null);
  const Icon = variant === 'guide' ? Compass : BookText;
  const domainMeta = domain ? DOMAIN_BY_ID[domain] : null;

  return (
    <Link
      href={href}
      className="group block h-full bg-white rounded-card border border-neutral-200 overflow-hidden hover:border-brand-purple-700 transition-colors flex flex-col"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="aspect-[16/9] relative"
        style={
          cover
            ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: 'linear-gradient(135deg, var(--color-brand-purple-100), var(--color-brand-purple-50) 70%, #FFFFFF)' }
        }
      >
        {!cover && (
          <div className="absolute inset-0 flex items-center justify-center text-brand-purple-300">
            <Icon className="w-10 h-10" strokeWidth={1.6} />
          </div>
        )}

        {ytId && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white shadow-lg ring-1 ring-white/30">
              <Play className="w-5 h-5 ms-0.5 fill-white" strokeWidth={0} />
            </span>
          </div>
        )}

        {domainMeta && (
          <div className={['absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-bold border', domainBadgeClasses(domain)].join(' ')}>
            {domainMeta.label}
          </div>
        )}

        {locked && (
          <div className="absolute bottom-3 right-3 bg-white rounded-pill px-2 py-1 flex items-center gap-1 text-[10px] font-bold text-brand-purple-700">
            <Lock className="w-3 h-3" />
            פרימיום
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-extrabold text-neutral-950 group-hover:text-brand-purple-700 transition-colors mb-1.5 leading-snug">
          {title}
        </h3>
        {tagline && <p className="text-sm text-neutral-500 line-clamp-2">{tagline}</p>}
      </div>
    </Link>
  );
}
