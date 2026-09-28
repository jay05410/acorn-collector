import { useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { useFieldControl, useFieldLabelId } from './field-context';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Needed unless the stepper sits in a <Field group>. */
  'aria-label'?: string;
  className?: string;
}

const STEP_BUTTON =
  'flex w-10 shrink-0 cursor-pointer items-center justify-center text-fg-muted transition-colors duration-150 ease-out hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4';

/**
 * Quantity input (WAI-ARIA spinbutton): type a number, use Arrow Up/Down,
 * Page Up/Down, Home/End, or the -/+ buttons.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  'aria-label': ariaLabel,
  className,
}: StepperProps) {
  useLanguage();
  const fieldProps = useFieldControl({});
  const fieldLabelId = useFieldLabelId();
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    setDraft(null);
    onChange(clamp(n));
  };
  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    set(Number.isFinite(parsed) ? parsed : value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const steps: Record<string, number> = {
      ArrowUp: value + 1,
      ArrowDown: value - 1,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: min,
      End: max,
    };
    const next = steps[event.key];
    if (next !== undefined) {
      event.preventDefault();
      set(next);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div
      className={cn(
        'inline-flex h-11 items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-xs',
        'focus-within:border-focus focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-focus',
        className
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('ui', 'decrease')}
        title={t('ui', 'decrease')}
        disabled={value <= min}
        onClick={() => set(value - 1)}
        className={STEP_BUTTON}
      >
        <Minus />
      </button>
      <input
        {...fieldProps}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : fieldLabelId}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-10 min-w-0 flex-1 border-x border-line bg-transparent text-center text-sm font-semibold text-fg tabular-nums outline-none focus-visible:outline-none"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('ui', 'increase')}
        title={t('ui', 'increase')}
        disabled={value >= max}
        onClick={() => set(value + 1)}
        className={STEP_BUTTON}
      >
        <Plus />
      </button>
    </div>
  );
}
