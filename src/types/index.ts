export interface Event {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  mapImageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Booth {
  id: string;
  eventId: string;
  boothNumber: string;
  circleName: string;
  sourceUrl: string | null;
  memo: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id: string;
  boothId: string;
  name: string;
  price: number | null;
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

export interface ParsedBooth {
  eventHint?: string;
  boothNumber?: string;
  circleName?: string;
  confidence: number;
}
