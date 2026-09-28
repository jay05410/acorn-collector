import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { controlClassName, useFieldControl } from './field-context';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select with the shared control look. `className` sizes the box. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    const fieldProps = useFieldControl(props);
    return (
      <div className={cn('relative', className)}>
        <select
          ref={ref}
          {...props}
          {...fieldProps}
          className={cn(
            controlClassName,
            'h-11 cursor-pointer appearance-none pr-9 pl-3'
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
        />
      </div>
    );
  }
);

Select.displayName = 'Select';
