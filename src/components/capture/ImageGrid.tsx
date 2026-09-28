import { ImageOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { t, tp, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

interface ImageGridProps {
  images: readonly { url: string; alt?: string }[];
  /** Per image: used for analysis and kept on save. */
  included: readonly boolean[];
  onToggle: (index: number) => void;
  /** Indices the AI could not read. */
  skipped: ReadonlySet<number>;
  className?: string;
}

/** Thumbnails with a "use this image" checkbox each. */
export function ImageGrid({ images, included, onToggle, skipped, className }: ImageGridProps) {
  useLanguage();
  return (
    <ul aria-label={t('capture', 'imagesHeading')} className={cn('grid grid-cols-3 gap-2', className)}>
      {images.map((image, index) => {
        const isIncluded = included[index] ?? false;
        return (
          <li
            key={`${index}-${image.url}`}
            className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-sunken"
          >
            <img
              src={image.url}
              alt={image.alt || tp('capture', 'imageAlt', { index: index + 1 })}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={cn(
                'size-full object-cover transition-opacity duration-150',
                !isIncluded && 'opacity-40 grayscale'
              )}
            />
            <Checkbox
              checked={isIncluded}
              onCheckedChange={() => onToggle(index)}
              aria-label={tp('capture', 'useImage', { index: index + 1 })}
              className="absolute top-0 left-0"
            />
            {skipped.has(index) && (
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-warning-soft px-1.5 py-1 text-[11px] font-medium text-warning">
                <ImageOff aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{t('capture', 'imageSkipped')}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
