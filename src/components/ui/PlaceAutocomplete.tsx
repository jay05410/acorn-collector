import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPlaces, hasKakaoApiKey, type KakaoPlace } from '@/lib/kakao';

const COMMON_VENUES = [
  { name: '코엑스', address: '서울 강남구 영동대로 513' },
  { name: '세텍 (SETEC)', address: '서울 강남구 남부순환로 3104' },
  { name: 'aT센터', address: '서울 서초구 강남대로 27' },
  { name: '킨텍스 (KINTEX)', address: '경기 고양시 일산서구 킨텍스로 217-60' },
  { name: '벡스코 (BEXCO)', address: '부산 해운대구 APEC로 55' },
  { name: '대구 엑스코 (EXCO)', address: '대구 북구 엑스코로 10' },
  { name: '송도컨벤시아', address: '인천 연수구 센트럴로 123' },
  { name: 'DDP (동대문디자인플라자)', address: '서울 중구 을지로 281' },
];

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
  placeholder = '장소 검색',
  className,
}: PlaceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasApiKey = hasKakaoApiKey();

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
        if (!query.trim()) {
          setVenues(COMMON_VENUES);
        } else {
          const filtered = COMMON_VENUES.filter(
            (venue) =>
              venue.name.toLowerCase().includes(query.toLowerCase()) ||
              venue.address.toLowerCase().includes(query.toLowerCase())
          );
          setVenues(filtered);
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchPlaces(query);
        const mappedVenues: Venue[] = results.map((place: KakaoPlace) => ({
          name: place.place_name,
          address: place.road_address_name || place.address_name,
        }));
        setVenues(
          mappedVenues.length > 0
            ? mappedVenues
            : COMMON_VENUES.filter(
                (venue) =>
                  venue.name.toLowerCase().includes(query.toLowerCase()) ||
                  venue.address.toLowerCase().includes(query.toLowerCase())
              )
        );
      } catch {
        const filtered = COMMON_VENUES.filter(
          (venue) =>
            venue.name.toLowerCase().includes(query.toLowerCase()) ||
            venue.address.toLowerCase().includes(query.toLowerCase())
        );
        setVenues(filtered);
      } finally {
        setIsLoading(false);
      }
    },
    [hasApiKey]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);
      setIsOpen(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchWithApi(newValue);
      }, 300);
    },
    [onChange, searchWithApi]
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
    setIsOpen(true);
    if (inputValue) {
      searchWithApi(inputValue);
    } else {
      setVenues(COMMON_VENUES);
    }
  }, [inputValue, searchWithApi]);

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
