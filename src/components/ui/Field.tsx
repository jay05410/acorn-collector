import { useId, useMemo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldContext, type FieldContextValue } from './field-context';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Shows a required marker and sets aria-required on the control. */
  required?: boolean;
  /**
   * The control is a group (radiogroup, stepper): the label is rendered as
   * text and referenced with aria-labelledby instead of <label for>.
   */
  group?: boolean;
  className?: string;
  children: ReactNode;
}

const LABEL = 'text-[13px] leading-5 font-medium text-fg';

/** Label, control, hint and error, connected for assistive technology. */
export function Field({
  label,
  hint,
  error,
  required = false,
  group = false,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const context = useMemo<FieldContextValue>(
    () => ({
      controlId: `${id}-control`,
      labelId: `${id}-label`,
      describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
      invalid: Boolean(error),
      required,
    }),
    [id, errorId, hintId, error, required]
  );

  const marker = required && (
    <span aria-hidden="true" className="ms-0.5 text-danger">
      *
    </span>
  );

  return (
    <FieldContext.Provider value={context}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        {group ? (
          <span id={context.labelId} className={LABEL}>
            {label}
            {marker}
          </span>
        ) : (
          <label
            id={context.labelId}
            htmlFor={context.controlId}
            className={LABEL}
          >
            {label}
            {marker}
          </label>
        )}
        {children}
        {hint && (
          <p id={hintId} className="text-xs text-fg-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="flex items-center gap-1 text-xs font-medium text-danger"
          >
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
