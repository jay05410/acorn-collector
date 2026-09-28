import { cn } from '@/lib/utils';

/** The acorn brand mark, tinted by the active color theme. Decorative. */
export function AcornMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary-soft',
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5">
        <path
          d="M12.2 4.4c0-1.2.6-2.2 1.7-2.8"
          fill="none"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="stroke-primary-strong"
        />
        <path
          d="M5.6 11.6h12.8v1.3c0 4.2-2.8 7.8-6.4 9.1-3.6-1.3-6.4-4.9-6.4-9.1Z"
          className="fill-primary"
        />
        <path
          d="M8.6 14.2c.3 1.7 1 3.1 2 4.2"
          fill="none"
          strokeWidth="1.4"
          strokeLinecap="round"
          stroke="white"
          opacity="0.5"
        />
        <path
          d="M3.4 10.4C3.4 6.9 7.2 4.3 12 4.3s8.6 2.6 8.6 6.1c0 .8-.6 1.4-1.4 1.4H4.8c-.8 0-1.4-.6-1.4-1.4Z"
          className="fill-primary-strong"
        />
        <g className="fill-primary-soft" opacity="0.55">
          <circle cx="8" cy="8.6" r="0.9" />
          <circle cx="12" cy="7.4" r="0.9" />
          <circle cx="16" cy="8.6" r="0.9" />
        </g>
      </svg>
    </span>
  );
}
