import { useState } from 'react';
import { Coffee, Info, Megaphone, Share2, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FEATURES } from '@/config/monetization';
import { t, useLanguage } from '@/i18n';
import type { Placement } from '@/lib/sponsor/feed';
import type { DisplayCreative, HouseIcon } from '@/lib/sponsor/house';
import { withUtm } from '@/lib/sponsor/links';
import { cn } from '@/lib/utils';
import { AboutAds } from './AboutAds';
import { ExternalLink } from './ExternalLink';
import { useSponsorCreative } from './useSponsorCreative';

interface SponsorSlotProps {
  placement: Placement;
  className?: string;
}

interface SlotLayout {
  /** Fixed height and frame; the slot never grows with its content. */
  frame: string;
  thumb: string;
  showBody: boolean;
  /** CTA chip visibility; the card itself is the link either way. */
  cta: string;
}

const LAYOUTS: Record<Placement, SlotLayout> = {
  footer: {
    frame:
      'h-16 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    thumb: 'h-10 w-10',
    showBody: false,
    cta: 'block',
  },
  analysis: {
    frame:
      'h-24 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    thumb: 'h-14 w-14',
    showBody: true,
    // Narrow cards keep the room for the title and body.
    cta: 'hidden @sm:block',
  },
  settings: {
    frame:
      'h-24 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    thumb: 'h-14 w-14',
    showBody: true,
    cta: 'hidden @sm:block',
  },
};

const ICONS: Record<HouseIcon, LucideIcon> = {
  coffee: Coffee,
  star: Star,
  share: Share2,
  megaphone: Megaphone,
};

function Thumbnail({
  creative,
  className,
}: {
  creative: DisplayCreative;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = ICONS[creative.icon ?? 'megaphone'];
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-light text-accent dark:bg-primary/15 dark:text-primary',
        className
      )}
    >
      {creative.imageUrl && !imageFailed ? (
        // Decorative: the link text already names the sponsor and offer.
        <img
          src={creative.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon className="h-5 w-5" aria-hidden="true" />
      )}
    </span>
  );
}

function SlotContent({ placement, className }: SponsorSlotProps) {
  useLanguage();
  const creative = useSponsorCreative(placement);
  const [aboutOpen, setAboutOpen] = useState(false);
  const layout = LAYOUTS[placement];

  if (creative === null) return null;

  const frame = cn(
    '@container flex w-full items-stretch overflow-hidden',
    layout.frame,
    className
  );

  if (creative === undefined) {
    return (
      <aside
        aria-label={t('support', 'adRegion')}
        aria-busy="true"
        className={cn(frame, 'items-center gap-3 px-3')}
      >
        <span
          className={cn(
            'shrink-0 rounded-md bg-gray-100 motion-safe:animate-pulse dark:bg-gray-700',
            layout.thumb
          )}
        />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-3 w-16 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-700" />
          <span className="h-3.5 w-3/4 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-700" />
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label={t('support', 'adRegion')}
      data-placement={placement}
      className={frame}
    >
      <ExternalLink
        href={withUtm(creative.clickUrl, placement)}
        rel="sponsored"
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-1 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-gray-700/50"
      >
        <Thumbnail
          key={`${creative.id}:${creative.imageUrl ?? ''}`}
          creative={creative}
          className={layout.thumb}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
            <span className="shrink-0 rounded border border-gray-300 px-1 font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300">
              {t('support', 'adLabel')}
            </span>
            <span className="truncate">{creative.sponsorName}</span>
          </span>
          <span className="truncate text-sm font-medium leading-5 text-gray-900 dark:text-gray-100">
            {creative.title}
          </span>
          {layout.showBody && creative.body && (
            <span className="line-clamp-2 text-xs leading-4 text-gray-600 dark:text-gray-400">
              {creative.body}
            </span>
          )}
        </span>
        {creative.cta && (
          <span
            className={cn(
              'max-w-[6.5rem] shrink-0 truncate rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-gray-800 dark:bg-primary/15 dark:text-primary',
              layout.cta
            )}
          >
            {creative.cta}
          </span>
        )}
      </ExternalLink>
      <button
        type="button"
        aria-label={t('support', 'aboutAdsButton')}
        aria-haspopup="dialog"
        onClick={() => setAboutOpen(true)}
        className="flex w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <AboutAds open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </aside>
  );
}

/**
 * A labeled, fixed-size sponsor card. The whole card is one link (UTM-tagged,
 * opened in a new tab); the (i) button beside it explains how ads work.
 * Mount at most one slot per placement at a time.
 */
export function SponsorSlot(props: SponsorSlotProps) {
  if (!FEATURES.sponsorSlots) return null;
  return <SlotContent {...props} />;
}
