import { cn } from '@/lib/utils';

interface SpinnerProps {
  /** Announced to screen readers; omit when the spinner is decorative. */
  label?: string;
  /**
   * Classes for the outermost element: the ring, or the status wrapper when
   * labelled, so positioning classes (e.g. `absolute`) take it out of flow.
   */
  className?: string;
}

/** Indeterminate progress ring; inherits the current text color. */
export function Spinner({ label, className }: SpinnerProps) {
  const ring = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-4 shrink-0 animate-spin', !label && className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );

  if (!label) return ring;
  return (
    <span role="status" className={cn('inline-flex items-center', className)}>
      {ring}
      <span className="sr-only">{label}</span>
    </span>
  );
}
