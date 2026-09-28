import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'size'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * A native checkbox drawn as a 20px box inside a 44px hit target. It renders
 * no label: wrap it (and its text) in a <label>, or pass aria-label.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <span
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center',
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-lg opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-5 items-center justify-center rounded-md border-2 border-line-strong bg-surface-raised text-transparent',
          'transition-[background-color,border-color,color] duration-150 ease-out',
          'peer-hover:border-fg-subtle',
          'peer-checked:border-primary-strong peer-checked:bg-primary-strong peer-checked:text-on-primary',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
          'peer-disabled:opacity-50'
        )}
      >
        <Check className="size-3.5" strokeWidth={3.25} />
      </span>
    </span>
  )
);

Checkbox.displayName = 'Checkbox';
