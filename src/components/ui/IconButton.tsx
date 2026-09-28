import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> {
  /** Accessible name, also shown as the tooltip. Required: there is no text. */
  label: string;
  children: ReactNode;
  variant?: 'ghost' | 'secondary' | 'soft' | 'primary' | 'danger';
  /** Visual size; the hit target is always at least 44x44. */
  size?: 'sm' | 'md';
}

const VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost: 'text-fg-muted hover:bg-hover hover:text-fg active:bg-pressed',
  secondary:
    'border border-line bg-surface-raised text-fg-muted shadow-xs hover:bg-surface-sunken hover:text-fg',
  soft: 'bg-primary-soft text-primary-strong hover:bg-primary-soft-hover',
  primary: 'bg-primary-strong text-on-primary hover:bg-primary-strong-hover',
  danger: 'text-fg-muted hover:bg-danger-soft hover:text-danger',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      children,
      variant = 'ghost',
      size = 'md',
      type = 'button',
      className,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        'hit-area inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg',
        'transition-colors duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm'
          ? 'size-8 [&_svg]:size-4'
          : 'size-9 [&_svg]:size-[1.125rem]',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
