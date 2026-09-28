/** ISO 4217 currency code, e.g. "KRW", "JPY", "TWD". */
export type CurrencyCode = string;

export const ITEM_CATEGORIES = [
  'acrylic',
  'keyring',
  'stand',
  'poster',
  'postcard',
  'sticker',
  'photocard',
  'memo',
  'tape',
  'badge',
  'book',
  'calendar',
  'pouch',
  'plush',
  'apparel',
  'set',
  'digital',
  'other',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface Event {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  mapImageUrl: string | null;
  /** Default currency for items of this event. Added in DB v5. */
  currency: CurrencyCode | null;
  createdAt: number;
  updatedAt: number;
}

export interface Booth {
  id: string;
  eventId: string;
  boothNumber: string;
  circleName: string;
  zone: string | null;
  sourceUrl: string | null;
  formUrl: string | null;
  memo: string | null;
  imageUrls: string[] | null;
  /** Original-language post text captured with the booth. Added in DB v5. */
  sourceText: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id: string;
  boothId: string;
  /** Display name, usually in the user's language. */
  name: string;
  /** Verbatim name from the source when it differs from `name`. Added in DB v5. */
  originalName: string | null;
  price: number | null;
  /** Currency of `price`; null means "use the event currency". Added in DB v5. */
  currency: CurrencyCode | null;
  /** Added in DB v5. */
  category: ItemCategory | null;
  /** Selected variant (e.g. "A", "Luna"). Added in DB v5. */
  option: string | null;
  badgeId: string;
  checked: boolean;
  quantity: number;
  createdAt: number;
}

export interface Badge {
  id: string;
  label: string;
  isPreset: boolean;
  color: string | null;
  createdAt: number;
}

export type PresetBadgeId = 'purchase' | 'pickup' | 'etc';

/** Result of the instant, offline heuristic text parser. */
export interface ParsedBooth {
  eventHint?: string;
  boothNumber?: string;
  circleName?: string;
  zone?: string;
  formUrl?: string;
  confidence: number;
}
