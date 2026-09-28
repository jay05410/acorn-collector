import { EVENT_CURRENCIES } from '@/constants/currencies';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

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
  const listed = (EVENT_CURRENCIES as readonly string[]).includes(value);
  const options = listed ? EVENT_CURRENCIES : [value, ...EVENT_CURRENCIES];
  const label = t('currency', 'label');

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      title={label}
      className={cn(
        'h-10 px-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary',
        className
      )}
    >
      {options.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}
