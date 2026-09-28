import { tp, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

interface ProgressProps {
  /** Checked items. */
  value: number;
  /** All items; the meter is hidden when there are none. */
  max: number;
  className?: string;
}

/** Compact checked-items meter: a thin bar and "3/6". */
export function Progress({ value, max, className }: ProgressProps) {
  useLanguage();
  if (max <= 0) return null;
  const done = value >= max;
  const percent = Math.round((Math.min(value, max) / max) * 100);
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={tp('ui', 'progress', { checked: value, total: max })}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line ring-inset">
        <span
          className={cn(
            'block h-full rounded-full transition-[width] duration-200 ease-out',
            done ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'text-xs font-medium tabular-nums',
          done ? 'text-success' : 'text-fg-muted'
        )}
      >
        {value}/{max}
      </span>
    </span>
  );
}
