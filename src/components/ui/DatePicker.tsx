import { useState, useRef, useEffect, useCallback } from 'react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, parseIsoDate, t, toIsoDate, useLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n/languages';

type LocaleLanguage = Exclude<AppLanguage, 'en'>;

/**
 * Calendar locales load on demand, one small chunk per language. English uses
 * DayPicker's built-in en-US locale.
 */
const LOCALE_LOADERS: Record<LocaleLanguage, () => Promise<DayPickerLocale>> = {
  ko: () => import('react-day-picker/locale/ko').then((m) => m.ko),
  ja: () => import('react-day-picker/locale/ja').then((m) => m.ja),
  'zh-CN': () => import('react-day-picker/locale/zh-CN').then((m) => m.zhCN),
  'zh-TW': () => import('react-day-picker/locale/zh-TW').then((m) => m.zhTW),
  th: () => import('react-day-picker/locale/th').then((m) => m.th),
  id: () => import('react-day-picker/locale/id').then((m) => m.id),
  vi: () => import('react-day-picker/locale/vi').then((m) => m.vi),
  es: () => import('react-day-picker/locale/es').then((m) => m.es),
  fr: () => import('react-day-picker/locale/fr').then((m) => m.fr),
  de: () => import('react-day-picker/locale/de').then((m) => m.de),
  'pt-BR': () => import('react-day-picker/locale/pt-BR').then((m) => m.ptBR),
};

const loadedLocales = new Map<AppLanguage, DayPickerLocale>();

function useDayPickerLocale(
  language: AppLanguage
): DayPickerLocale | undefined {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (language === 'en' || loadedLocales.has(language)) return;
    let active = true;
    LOCALE_LOADERS[language]()
      .then((locale) => {
        loadedLocales.set(language, locale);
        if (active) setVersion((v) => v + 1);
      })
      .catch((error: unknown) => {
        console.error(
          `[DatePicker] could not load the ${language} locale`,
          error
        );
      });
    return () => {
      active = false;
    };
  }, [language]);

  return loadedLocales.get(language);
}

interface DatePickerProps {
  /** "YYYY-MM-DD" or empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
}: DatePickerProps) {
  const language = useLanguage();
  const locale = useDayPickerLocale(language);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const openedByFocus = useRef(false);

  const selectedDate = value ? parseIsoDate(value) : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      onChange(date ? toIsoDate(date) : '');
      setIsOpen(false);
    },
    [onChange]
  );

  const handleButtonClick = useCallback(() => {
    if (openedByFocus.current) {
      openedByFocus.current = false;
      return;
    }
    setIsOpen((prev) => !prev);
  }, []);

  const handleButtonFocus = useCallback(() => {
    if (!isOpen) {
      openedByFocus.current = true;
      setIsOpen(true);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleButtonClick}
        onFocus={handleButtonFocus}
        className={cn(
          'flex items-center gap-2 w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary',
          value
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400',
          className
        )}
      >
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="flex-1">
          {value
            ? formatDate(value)
            : (placeholder ?? t('events', 'selectDate'))}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate}
            locale={locale}
            showOutsideDays
            autoFocus
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ),
            }}
            classNames={{
              months: 'flex flex-col',
              month: 'space-y-3',
              month_caption: 'flex justify-center relative items-center h-10',
              caption_label:
                'text-sm font-semibold text-gray-900 dark:text-white',
              nav: 'absolute inset-x-0 flex justify-between items-center',
              button_previous:
                'h-8 w-8 bg-transparent p-0 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center justify-center rounded-md transition-colors',
              button_next:
                'h-8 w-8 bg-transparent p-0 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center justify-center rounded-md transition-colors',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday:
                'text-gray-500 dark:text-gray-400 w-9 font-medium text-xs text-center',
              week: 'flex w-full mt-1',
              day: 'text-center text-sm relative p-0.5 focus-within:relative focus-within:z-20',
              day_button:
                'h-9 w-9 p-0 font-normal rounded-md text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary',
              selected:
                'bg-primary text-white hover:bg-primary-dark dark:bg-primary dark:hover:bg-primary-dark font-semibold',
              today:
                'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-semibold',
              outside: 'text-gray-300 dark:text-gray-600',
              disabled: 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => handleSelect(undefined)}
              className="w-full mt-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              {t('events', 'clearDate')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
