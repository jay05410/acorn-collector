import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500',
            checked
              ? 'bg-blue-600 border-blue-600'
              : 'border-gray-300 bg-white',
            className
          )}
        >
          {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
