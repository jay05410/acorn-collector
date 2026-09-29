import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, parseIsoDate, t, toIsoDate, useLanguage } from '@/i18n';
import {
  LANGUAGE_INFO,
  type AppLanguage,
  type DayPickerLocaleId,
} from '@/i18n/languages';
import { DAY_PICKER_LOCALES } from './day-picker-locales';
import {
  controlClassName,
  useFieldControl,
  useFieldLabelId,
} from './field-context';

const loadedLocales = new Map<DayPickerLocaleId, DayPickerLocale>();

/** The calendar locale of `language`, loaded on first use (see LANGUAGE_INFO). */
function useDayPickerLocale(
  language: AppLanguage
): DayPickerLocale | undefined {
  const id = LANGUAGE_INFO[language].dayPickerLocale;
  const [, setVersion] = useState(0);

  useEffect(() => {
    const load = DAY_PICKER_LOCALES[id];
    if (!load || loadedLocales.has(id)) return;
    let active = true;
    load()
      .then((locale) => {
        loadedLocales.set(id, locale);
        if (active) setVersion((v) => v + 1);
      })
      .catch((error: unknown) => {
        console.error(`[DatePicker] could not load the ${id} locale`, error);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return loadedLocales.get(id);
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
  const fieldLabelId = useFieldLabelId();
  const valueId = useId();
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
        // A <label for> alone would replace the content as the name, hiding
        // the chosen date: name it with the label and the value together.
        aria-labelledby={
          fieldLabelId ? `${fieldLabelId} ${valueId}` : undefined
        }
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
        <span id={valueId} className="min-w-0 flex-1 truncate tabular-nums">
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
