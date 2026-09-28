import { createContext, useContext, type AriaAttributes } from 'react';

export interface FieldContextValue {
  controlId: string;
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-required'?: AriaAttributes['aria-required'];
}

/**
 * Wires a single control (input, select, button) to the surrounding <Field>:
 * id for the label, hint/error descriptions, invalid and required state.
 * Props passed to the control itself take precedence.
 */
export function useFieldControl(own: FieldControlProps): FieldControlProps {
  const field = useContext(FieldContext);
  if (!field) return {};
  const describedBy = [own['aria-describedby'], field.describedBy]
    .filter(Boolean)
    .join(' ');
  return {
    id: own.id ?? field.controlId,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': own['aria-invalid'] ?? (field.invalid || undefined),
    'aria-required': own['aria-required'] ?? (field.required || undefined),
  };
}

/** Id of the surrounding <Field group> label, for aria-labelledby. */
export function useFieldLabelId(): string | undefined {
  return useContext(FieldContext)?.labelId;
}

/** Shared look of text-like controls (input, textarea, select, triggers). */
export const controlClassName =
  'w-full rounded-lg border border-line-strong bg-surface-raised text-sm text-fg shadow-xs ' +
  'placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ease-out ' +
  'hover:border-fg-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger ' +
  'disabled:cursor-not-allowed disabled:opacity-50';
