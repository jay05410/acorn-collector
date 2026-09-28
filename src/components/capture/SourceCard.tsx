import { useId, useState } from 'react';
import {
  AtSign,
  ExternalLink,
  Globe,
  Languages,
  Palette,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { t, useLanguage } from '@/i18n';
import type { PageSnapshot, SiteId } from '@/lib/capture/types';
import { cn } from '@/lib/utils';
import { ImageGrid } from './ImageGrid';

interface SourceCardProps {
  snapshot: PageSnapshot;
  /** Per snapshot image: kept for analysis and saving. */
  includedImages: readonly boolean[];
  onToggleImage: (index: number) => void;
  /** Snapshot image indices the AI could not read. */
  skippedImages: ReadonlySet<number>;
}

const SITE_ICONS: Record<SiteId, LucideIcon> = {
  x: AtSign,
  bluesky: AtSign,
  threads: AtSign,
  instagram: AtSign,
  pixiv: Palette,
  booth: Store,
  witchform: Store,
  generic: Globe,
};

/** Posts longer than this start collapsed. */
const COLLAPSE_CHARS = 180;
const COLLAPSE_LINES = 4;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The captured post: who wrote it, its text and its images. */
export function SourceCard({
  snapshot,
  includedImages,
  onToggleImage,
  skippedImages,
}: SourceCardProps) {
  useLanguage();
  const textId = useId();
  const [expanded, setExpanded] = useState(false);
  const [showDisplayed, setShowDisplayed] = useState(false);
  const Icon = SITE_ICONS[snapshot.site] ?? Globe;
  const host = hostOf(snapshot.url);
  const author = snapshot.author;
  const heading = author?.name || snapshot.title || host;
  const handle = author?.handle ? `@${author.handle.replace(/^@/, '')}` : null;
  const original = snapshot.text || snapshot.selection || '';
  const hasTranslation =
    snapshot.displayedText !== null && snapshot.displayedText !== original;
  const text = hasTranslation && showDisplayed ? (snapshot.displayedText ?? '') : original;
  const long =
    text.length > COLLAPSE_CHARS || text.split('\n').length > COLLAPSE_LINES;

  return (
    <Card as="section" aria-label={t('capture', 'sourceHeading')} className="p-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-fg-muted [&_svg]:size-4"
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{heading}</p>
          <p className="truncate text-xs text-fg-subtle">
            {[handle, host].filter(Boolean).join(' · ')}
          </p>
        </div>
        <a
          href={snapshot.url}
          target="_blank"
          rel="noopener noreferrer"
          title={t('booths', 'openSource')}
          className="hit-area inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg [&_svg]:size-4"
        >
          <ExternalLink aria-hidden="true" />
          <span className="sr-only">
            {t('booths', 'openSource')} ({t('ui', 'opensInNewTab')})
          </span>
        </a>
      </div>

      {text && (
        <div className="mt-2.5">
          <p
            id={textId}
            className={cn(
              'text-sm leading-relaxed break-words whitespace-pre-wrap text-fg',
              long && !expanded && 'line-clamp-4'
            )}
          >
            {text}
          </p>
          {(long || hasTranslation) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {long && (
                <Button
                  variant="link"
                  aria-expanded={expanded}
                  aria-controls={textId}
                  onClick={() => setExpanded((value) => !value)}
                  className="min-h-11 text-[13px] font-medium"
                >
                  {expanded ? t('capture', 'showLess') : t('capture', 'showMore')}
                </Button>
              )}
              {hasTranslation && (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
                  <Languages aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>
                    {showDisplayed
                      ? t('capture', 'showingTranslation')
                      : t('capture', 'showingOriginal')}
                  </span>
                  <Button
                    variant="link"
                    onClick={() => setShowDisplayed((value) => !value)}
                    className="min-h-11 text-xs font-medium"
                  >
                    {showDisplayed
                      ? t('capture', 'showOriginal')
                      : t('capture', 'showTranslation')}
                  </Button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {snapshot.images.length > 0 && (
        <ImageGrid
          images={snapshot.images}
          included={includedImages}
          onToggle={onToggleImage}
          skipped={skippedImages}
          className="mt-3"
        />
      )}
    </Card>
  );
}
