import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useFieldControl } from './field-context';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'role' | 'aria-checked' | 'onChange' | 'children'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * On/off toggle (role="switch"). Name it with a <Field> label or aria-label;
 * Space and Enter toggle it like any button.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, onClick, className, ...props }, ref) => {
    const fieldProps = useFieldControl(props);
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        {...props}
        {...fieldProps}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onCheckedChange(!checked);
        }}
        className={cn(
          'hit-area inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5',
          'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary-strong' : 'bg-line-strong',
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-5 rounded-full shadow-sm transition-transform duration-150 ease-out',
            checked
              ? 'translate-x-4 bg-on-primary'
              : 'bg-surface-raised dark:bg-fg'
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
