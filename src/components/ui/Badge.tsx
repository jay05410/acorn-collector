import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  /** Semantic tone; ignored when `color` is set. */
  tone?: BadgeTone;
  /** A user-chosen color (item badges). Text is derived to stay readable. */
  color?: string | null;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-fg-muted',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

/** Small non-interactive label chip. */
export function Badge({
  children,
  tone = 'neutral',
  color,
  icon,
  size = 'sm',
  className,
}: BadgeProps) {
  const style = color ? ({ '--badge': color } as CSSProperties) : undefined;
  return (
    <span
      style={style}
      className={cn(
        'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1 rounded-md font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
        size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
        color ? 'badge-tint' : TONES[tone],
        className
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
