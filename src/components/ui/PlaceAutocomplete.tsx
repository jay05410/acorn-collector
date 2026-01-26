import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPlaces, hasKakaoApiKey, type KakaoPlace } from '@/lib/kakao';
import {
  searchGooglePlaces,
  hasGooglePlacesApiKey,
  type GooglePlace,
} from '@/lib/google-places';
import { getLanguage } from '@/lib/i18n';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isKorean = getLanguage() === 'ko';
  const hasApiKey = isKorean ? hasKakaoApiKey() : hasGooglePlacesApiKey();

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchWithApi = useCallback(
    async (query: string) => {
      if (!hasApiKey || !query.trim()) {
        setVenues([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (isKorean) {
          const results = await searchPlaces(query);
          const mappedVenues: Venue[] = results.map((place: KakaoPlace) => ({
            name: place.place_name,
            address: place.road_address_name || place.address_name,
          }));
          setVenues(mappedVenues);
        } else {
          const results = await searchGooglePlaces(query);
          const mappedVenues: Venue[] = results.map((place: GooglePlace) => ({
            name: place.name,
            address: place.formatted_address,
          }));
          setVenues(mappedVenues);
        }
      } catch {
        setVenues([]);
      } finally {
        setIsLoading(false);
      }
    },
    [hasApiKey, isKorean]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);

      if (!hasApiKey) return;

      setIsOpen(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchWithApi(newValue);
      }, 300);
    },
    [onChange, searchWithApi, hasApiKey]
  );

  const handleSelectVenue = useCallback(
    (venue: Venue) => {
      const selectedValue = venue.name;
      setInputValue(selectedValue);
      onChange(selectedValue);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (hasApiKey && inputValue) {
      setIsOpen(true);
      searchWithApi(inputValue);
    }
  }, [inputValue, searchWithApi, hasApiKey]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 pl-9 pr-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary',
            className
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {isOpen && venues.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
          {venues.map((venue, index) => (
            <button
              key={`${venue.name}-${index}`}
              type="button"
              onClick={() => handleSelectVenue(venue)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">
                {venue.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {venue.address}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
