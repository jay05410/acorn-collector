import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPlaces, hasKakaoApiKey, type KakaoPlace } from '@/lib/kakao';
import {
  searchGooglePlaces,
  hasGooglePlacesApiKey,
  type GooglePlace,
} from '@/lib/google-places';
import { getLanguageInfo, t, useLanguage } from '@/i18n';
import { controlClassName, useFieldControl } from './field-context';
import { Spinner } from './Spinner';

interface Venue {
  name: string;
  address: string;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Venue text field with place suggestions (WAI-ARIA combobox + listbox). */
export function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: PlaceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();
  const fieldProps = useFieldControl({});

  const isKorean = useLanguage() === 'ko';
  const hasApiKey = isKorean ? hasKakaoApiKey() : hasGooglePlacesApiKey();
  const showList = isOpen && venues.length > 0;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showVenues = useCallback((list: Venue[]) => {
    setVenues(list);
    setActiveIndex(-1);
  }, []);

  const searchWithApi = useCallback(
    async (query: string) => {
      if (!hasApiKey || !query.trim()) {
        showVenues([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (isKorean) {
          const results = await searchPlaces(query);
          showVenues(
            results.map((place: KakaoPlace) => ({
              name: place.place_name,
              address: place.road_address_name || place.address_name,
            }))
          );
        } else {
          const results = await searchGooglePlaces(
            query,
            getLanguageInfo().intlLocale
          );
          showVenues(
            results.map((place: GooglePlace) => ({
              name: place.name,
              address: place.formatted_address,
            }))
          );
        }
      } catch {
        showVenues([]);
      } finally {
        setIsLoading(false);
      }
    },
    [hasApiKey, isKorean, showVenues]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);

      if (!hasApiKey) return;

      setIsOpen(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void searchWithApi(newValue);
      }, 300);
    },
    [onChange, searchWithApi, hasApiKey]
  );

  const handleSelectVenue = useCallback(
    (venue: Venue) => {
      setInputValue(venue.name);
      onChange(venue.name);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (hasApiKey && inputValue) {
      setIsOpen(true);
      void searchWithApi(inputValue);
    }
  }, [inputValue, searchWithApi, hasApiKey]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (showList) {
        // Consumed here so an enclosing dialog stays open.
        e.stopPropagation();
        setIsOpen(false);
      }
      return;
    }
    if (!showList) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(
        (index) => (index + step + venues.length) % venues.length
      );
    } else if (e.key === 'Enter') {
      const venue = venues[activeIndex];
      if (venue) {
        e.preventDefault();
        handleSelectVenue(venue);
      }
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div ref={containerRef} className="relative">
      <MapPin
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
      <input
        {...fieldProps}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={
          showList && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(controlClassName, 'h-11 pr-9 pl-9', className)}
      />
      {isLoading && (
        <Spinner
          label={t('common', 'loading')}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle"
        />
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-(--z-popover) mt-1.5 max-h-60 animate-pop-in overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lg"
        >
          {venues.map((venue, index) => (
            <li
              key={`${venue.name}-${index}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => handleSelectVenue(venue)}
              className={cn(
                'cursor-pointer rounded-lg px-3 py-2',
                index === activeIndex && 'bg-hover'
              )}
            >
              <div className="truncate text-sm font-medium text-fg">
                {venue.name}
              </div>
              <div className="mt-0.5 truncate text-xs text-fg-muted">
                {venue.address}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
