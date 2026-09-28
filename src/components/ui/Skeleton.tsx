import { cn } from '@/lib/utils';

/** Placeholder block for content that is still loading. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-surface-sunken',
        className
      )}
    />
  );
}
