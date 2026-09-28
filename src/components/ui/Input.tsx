import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { controlClassName, useFieldControl } from './field-context';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Short non-interactive suffix inside the field, e.g. a currency code. */
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, trailing, ...props }, ref) => {
    const fieldProps = useFieldControl(props);
    const input = (
      <input
        ref={ref}
        {...props}
        {...fieldProps}
        className={cn(
          controlClassName,
          'h-11 px-3',
          trailing ? 'pr-12' : undefined,
          className
        )}
      />
    );
    if (!trailing) return input;
    return (
      <div className="relative">
        {input}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-fg-subtle">
          {trailing}
        </span>
      </div>
    );
  }
);

Input.displayName = 'Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => {
    const fieldProps = useFieldControl(props);
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...props}
        {...fieldProps}
        className={cn(
          controlClassName,
          'min-h-20 resize-y px-3 py-2.5 leading-relaxed',
          className
        )}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
