import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFieldLabelId } from './field-context';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** User color (badges); shown as a dot and as the selected tint. */
  color?: string | null;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Needed unless the control sits in a <Field group>. */
  'aria-label'?: string;
  /** `track`: equal segments in a well. `chips`: wrapping pills. */
  variant?: 'track' | 'chips';
  size?: 'sm' | 'md';
  className?: string;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/** Index the key moves to, or null when the key is not a navigation key. */
function targetIndex(key: string, from: number, count: number): number | null {
  if (NEXT_KEYS.has(key)) return (from + 1) % count;
  if (PREVIOUS_KEYS.has(key)) return (from - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * Single choice among a few options (WAI-ARIA radio group): one tab stop,
 * arrow keys move the selection and wrap, Home/End jump to the ends.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  variant = 'track',
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const fieldLabelId = useFieldLabelId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = targetIndex(event.key, index, options.length);
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    event.preventDefault();
    onChange(option.value);
    buttons.current[next]?.focus();
  };

  const chips = variant === 'chips';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : fieldLabelId}
      className={cn(
        chips
          ? 'flex flex-wrap gap-1.5'
          : 'grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-surface-sunken p-0.5 ring-1 ring-line ring-inset',
        className
      )}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const style = option.color
          ? ({ '--badge': option.color } as CSSProperties)
          : undefined;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            style={style}
            className={cn(
              'inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap',
              'transition-[background-color,color,border-color,box-shadow] duration-150 ease-out [&_svg]:size-3.5 [&_svg]:shrink-0',
              chips
                ? cn(
                    'h-9 rounded-full border px-3 text-sm',
                    !checked &&
                      'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg',
                    checked &&
                      (option.color
                        ? 'badge-tint border-(--badge)'
                        : 'border-primary-strong bg-primary-soft text-primary-strong')
                  )
                : cn(
                    'rounded-md px-2.5',
                    size === 'sm' ? 'hit-area h-7 text-xs' : 'h-9 text-sm',
                    checked
                      ? 'bg-surface-raised text-fg shadow-sm'
                      : 'text-fg-muted hover:text-fg'
                  )
            )}
          >
            {chips && checked && <Check aria-hidden="true" strokeWidth={3} />}
            {chips && !checked && option.color && (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-(--badge)"
              />
            )}
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
