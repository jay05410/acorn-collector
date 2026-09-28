import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

type CanonicalVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'link';

export type ButtonVariant =
  | CanonicalVariant
  /** @deprecated Alias of `primary`, kept for the ACORN-7 modals. */
  | 'default'
  /** @deprecated Alias of `secondary`, kept for the ACORN-7 modals. */
  | 'outline';

export type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  /** @deprecated Use IconButton, which requires an accessible label. */
  | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and ignores clicks while keeping focus. */
  loading?: boolean;
}

const VARIANTS: Record<CanonicalVariant, string> = {
  primary:
    'bg-primary-strong text-on-primary shadow-xs hover:bg-primary-strong-hover',
  secondary:
    'border border-line bg-surface-raised text-fg shadow-xs hover:bg-surface-sunken',
  soft: 'bg-primary-soft text-primary-strong hover:bg-primary-soft-hover',
  ghost: 'text-fg-muted hover:bg-hover hover:text-fg active:bg-pressed',
  danger: 'bg-danger text-on-danger shadow-xs hover:bg-danger-hover',
  link: 'text-sm text-primary-strong underline-offset-4 hover:underline',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'hit-area h-9 gap-1.5 px-3 text-sm [&_svg]:size-4',
  md: 'h-11 gap-2 px-4 text-sm [&_svg]:size-4',
  lg: 'h-12 gap-2 px-5 text-base [&_svg]:size-5',
  icon: 'hit-area size-10 p-0',
};

function canonical(variant: ButtonVariant): CanonicalVariant {
  if (variant === 'default') return 'primary';
  if (variant === 'outline') return 'secondary';
  return variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      type = 'button',
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const resolved = canonical(variant);
    return (
      <button
        ref={ref}
        type={type}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        {...props}
        onClick={(event) => {
          if (loading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-lg font-medium whitespace-nowrap',
          'transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ease-out',
          'disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-80',
          '[&_svg]:shrink-0',
          resolved === 'link' ? 'gap-1.5 [&_svg]:size-4' : SIZES[size],
          VARIANTS[resolved],
          className
        )}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
