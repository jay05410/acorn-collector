import { cn } from '@/lib/utils';

interface BoothNumberProps {
  children: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Booth or Comiket space number chip (e.g. "B-12") with tabular digits. */
export function BoothNumber({ children, size = 'md', className }: BoothNumberProps) {
  return (
    <span
      title={children}
      className={cn(
        'inline-flex max-w-28 shrink-0 items-center justify-center rounded-md bg-primary-soft font-bold text-primary-strong tabular-nums',
        size === 'sm' ? 'h-5 min-w-9 px-1.5 text-[11px]' : 'h-7 min-w-12 px-2 text-xs',
        className
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
