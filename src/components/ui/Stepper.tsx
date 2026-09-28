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
  'flex w-11 shrink-0 cursor-pointer items-center justify-center text-fg-muted transition-colors duration-150 ease-out hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4';

/**
 * Quantity input (WAI-ARIA spinbutton): type a number, use Arrow Up/Down,
 * Page Up/Down, Home/End, or the -/+ buttons. Enter commits the typed value
 * and still submits the surrounding form.
 *
 * A stored value outside [min, max] (older data, imports) is shown and kept
 * as is: the range widens to include it, so stepping moves it by one toward
 * the range instead of snapping it to the bound.
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

  const floor = Math.min(min, value);
  const ceiling = Math.max(max, value);
  const clamp = (n: number) => Math.min(ceiling, Math.max(floor, n));

  /** The typed value if there is one, else the committed value. */
  const current = (): number => {
    const parsed = draft === null ? Number.NaN : Number.parseInt(draft, 10);
    return Number.isFinite(parsed) ? parsed : value;
  };

  const set = (n: number) => {
    setDraft(null);
    const next = clamp(n);
    if (next !== value) onChange(next);
  };

  const commit = () => {
    if (draft !== null) set(current());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // No preventDefault: the parent re-renders with the committed value
      // before the browser submits the form.
      commit();
      return;
    }
    const base = current();
    const steps: Record<string, number> = {
      ArrowUp: base + 1,
      ArrowDown: base - 1,
      PageUp: base + 10,
      PageDown: base - 10,
      Home: floor,
      End: ceiling,
    };
    const next = steps[event.key];
    if (next !== undefined) {
      event.preventDefault();
      set(next);
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
        disabled={value <= floor}
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
        aria-valuemin={floor}
        aria-valuemax={ceiling}
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
        disabled={value >= ceiling}
        onClick={() => set(value + 1)}
        className={STEP_BUTTON}
      >
        <Plus />
      </button>
    </div>
  );
}
