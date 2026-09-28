import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, parseIsoDate, t, toIsoDate, useLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n/languages';
import { controlClassName, useFieldControl } from './field-context';

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

const NAV_BUTTON =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg';

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
  const fieldProps = useFieldControl({});
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
      triggerRef.current?.focus();
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    // Consumed here so an enclosing dialog stays open.
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      openedByFocus.current = false;
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        {...fieldProps}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleButtonClick}
        onFocus={handleButtonFocus}
        className={cn(
          controlClassName,
          'flex h-11 cursor-pointer items-center gap-2 px-3 text-left',
          value ? 'text-fg' : 'text-fg-subtle',
          className
        )}
      >
        <Calendar
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {value
            ? formatDate(value)
            : (placeholder ?? t('events', 'selectDate'))}
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t('events', 'selectDate')}
          tabIndex={-1}
          className="absolute top-full left-0 z-(--z-popover) mt-1.5 animate-pop-in rounded-xl border border-line bg-surface-raised p-3 shadow-lg outline-none"
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
                  <ChevronLeft aria-hidden="true" className="size-4" />
                ) : (
                  <ChevronRight aria-hidden="true" className="size-4" />
                ),
            }}
            classNames={{
              months: 'flex flex-col',
              month: 'space-y-2',
              month_caption: 'flex h-8 items-center justify-center',
              caption_label: 'text-sm font-semibold text-fg',
              nav: 'absolute inset-x-3 top-3 flex items-center justify-between',
              button_previous: NAV_BUTTON,
              button_next: NAV_BUTTON,
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday: 'w-9 text-center text-xs font-medium text-fg-subtle',
              week: 'mt-0.5 flex w-full',
              day: 'relative p-0 text-center text-sm',
              day_button:
                'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-fg tabular-nums transition-colors hover:bg-hover',
              selected:
                'font-semibold [&>button]:bg-primary-strong [&>button]:text-on-primary [&>button]:hover:bg-primary-strong-hover',
              today:
                'font-semibold [&>button]:text-primary-strong [&>button]:ring-1 [&>button]:ring-primary [&>button]:ring-inset',
              outside: '[&>button]:text-fg-subtle/60',
              disabled: 'opacity-40 [&>button]:cursor-not-allowed',
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => handleSelect(undefined)}
              className="mt-2 flex h-9 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              {t('events', 'clearDate')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
