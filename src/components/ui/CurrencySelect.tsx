import { useContext } from 'react';
import { EVENT_CURRENCIES } from '@/constants/currencies';
import { t, useLanguage } from '@/i18n';
import { FieldContext } from './field-context';
import { Select } from './Select';

interface CurrencySelectProps {
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

/** Compact ISO currency picker; keeps an unlisted current value selectable. */
export function CurrencySelect({
  value,
  onChange,
  className,
}: CurrencySelectProps) {
  useLanguage();
  const inField = useContext(FieldContext) !== null;
  const listed = (EVENT_CURRENCIES as readonly string[]).includes(value);
  const options = listed ? EVENT_CURRENCIES : [value, ...EVENT_CURRENCIES];
  const label = t('currency', 'label');

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={inField ? undefined : label}
      title={label}
      className={className}
    >
      {options.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </Select>
  );
}
