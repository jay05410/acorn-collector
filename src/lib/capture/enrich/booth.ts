// i18n-scan-ignore-file: BOOTH category keyword dictionary, never shown in the UI
/**
 * BOOTH (booth.pm) item data from the unofficial `/ja/items/<id>.json`
 * endpoint. Name, variations and prices map straight to prefilled items, so
 * no LLM call is needed. BOOTH prices are always JPY.
 */
import type { ExtractedItem } from '@/lib/ai/types';
import type { ItemCategory } from '@/types';
import { normalizeSnapshot } from '../snapshot';
import type { CapturedImage, PageSnapshot } from '../types';
import { isRecord } from '../util';
import { type EnrichDeps, fetchJson, stringOr } from './http';

export const BOOTH_CURRENCY = 'JPY';

const ITEM_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?items\/(\d+)\/?$/i;

/** Item id from booth.pm/<lang>/items/<id> or <shop>.booth.pm/items/<id>. */
export function parseBoothItemId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'booth.pm' && !host.endsWith('.booth.pm')) return null;
    return ITEM_PATH.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function boothItemJsonUrl(id: string): string {
  return `https://booth.pm/ja/items/${id}.json`;
}

/**
 * BOOTH category names (Japanese, as returned by the /ja/ endpoint) to item
 * categories. First match wins, so specific names precede generic ones.
 * This is a keyword dictionary, not user-visible text.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [string, ItemCategory]> = [
  ['アクリルキーホルダー', 'keyring'],
  ['キーホルダー', 'keyring'],
  ['アクリルフィギュア', 'stand'],
  ['アクリルスタンド', 'stand'],
  ['アクリルバッジ', 'badge'],
  ['アクリル', 'acrylic'],
  ['バッジ', 'badge'],
  ['ポストカード', 'postcard'],
  ['ポスター', 'poster'],
  ['タペストリー', 'poster'],
  ['ステッカー', 'sticker'],
  ['シール', 'sticker'],
  ['マスキングテープ', 'tape'],
  ['カレンダー', 'calendar'],
  ['ポーチ', 'pouch'],
  ['ぬいぐるみ', 'plush'],
  ['ファッション', 'apparel'],
  ['漫画', 'book'],
  ['小説', 'book'],
  ['書籍', 'book'],
  ['イラスト集', 'book'],
  ['技術書', 'book'],
  ['絵本', 'book'],
];

export function mapBoothCategory(
  names: ReadonlyArray<string | null>,
  digital: boolean
): ItemCategory {
  if (digital) return 'digital';
  for (const name of names) {
    if (!name) continue;
    const match = CATEGORY_KEYWORDS.find(([keyword]) => name.includes(keyword));
    if (match) return match[1];
  }
  return 'other';
}

interface BoothVariation {
  name: string | null;
  price: number | null;
  digital: boolean;
}

function parseDisplayPrice(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function variationsOf(item: Record<string, unknown>): BoothVariation[] {
  const raw = Array.isArray(item.variations) ? item.variations.filter(isRecord) : [];
  return raw.map((variation) => ({
    name: stringOr(variation.name)?.trim() ?? null,
    price:
      typeof variation.price === 'number' && Number.isFinite(variation.price)
        ? variation.price
        : null,
    digital: variation.type === 'digital',
  }));
}

/**
 * One item when all variations share a price (variation names become
 * options), otherwise one item per variation.
 */
export function mapBoothItems(item: Record<string, unknown>): ExtractedItem[] {
  const name = stringOr(item.name)?.trim();
  if (!name) return [];
  const category = isRecord(item.category) ? item.category : {};
  const parent = isRecord(category.parent) ? category.parent : {};
  const categoryNames = [stringOr(category.name), stringOr(parent.name)];
  const fallbackPrice = parseDisplayPrice(item.price);
  const variations = variationsOf(item);

  const make = (price: number | null, options: string[], digital: boolean): ExtractedItem => ({
    name,
    originalName: null,
    price,
    category: mapBoothCategory(categoryNames, digital),
    options,
  });

  if (variations.length === 0) return [make(fallbackPrice, [], false)];
  const prices = new Set(variations.map((variation) => variation.price));
  if (prices.size === 1) {
    const options = variations
      .map((variation) => variation.name)
      .filter((option): option is string => Boolean(option));
    return [
      make(
        variations[0]?.price ?? fallbackPrice,
        variations.length > 1 ? options : [],
        variations.every((variation) => variation.digital)
      ),
    ];
  }
  return variations.map((variation) =>
    make(
      variation.price ?? fallbackPrice,
      variation.name ? [variation.name] : [],
      variation.digital
    )
  );
}

export interface BoothItemData {
  title: string;
  description: string;
  shop: { name: string | null; url: string | null; subdomain: string | null };
  images: CapturedImage[];
  items: ExtractedItem[];
  publishedAt: string | null;
}

export function parseBoothItem(payload: unknown): BoothItemData | null {
  if (!isRecord(payload)) return null;
  const items = mapBoothItems(payload);
  if (!items.length) return null;
  const shop = isRecord(payload.shop) ? payload.shop : {};
  const images = (Array.isArray(payload.images) ? payload.images.filter(isRecord) : [])
    .map((image) => stringOr(image.original) ?? stringOr(image.resized))
    .filter((url): url is string => url !== null)
    .map((url) => ({ url }));
  return {
    title: stringOr(payload.name) ?? '',
    description: stringOr(payload.description) ?? '',
    shop: {
      name: stringOr(shop.name),
      url: stringOr(shop.url),
      subdomain: stringOr(shop.subdomain),
    },
    images,
    items,
    publishedAt: stringOr(payload.published_at),
  };
}

export async function fetchBoothItem(
  id: string,
  deps: EnrichDeps
): Promise<BoothItemData | null> {
  return parseBoothItem(await fetchJson(boothItemJsonUrl(id), deps));
}

export async function enrichBoothSnapshot(
  snapshot: PageSnapshot,
  deps: EnrichDeps
): Promise<PageSnapshot> {
  const id = parseBoothItemId(snapshot.canonicalUrl ?? '') ?? parseBoothItemId(snapshot.url);
  if (!id) return snapshot;
  const item = await fetchBoothItem(id, deps);
  if (!item) return snapshot;
  return normalizeSnapshot({
    ...snapshot,
    title: item.title || snapshot.title,
    text: item.description || snapshot.text,
    // The page's lang attribute is the BOOTH UI language, not the seller's.
    lang: item.description ? null : snapshot.lang,
    author:
      item.shop.name || item.shop.url
        ? { name: item.shop.name, handle: item.shop.subdomain, url: item.shop.url }
        : snapshot.author,
    publishedAt: snapshot.publishedAt ?? item.publishedAt,
    images: [...item.images, ...snapshot.images],
    prefilledItems: item.items,
    prefilledCurrency: BOOTH_CURRENCY,
  });
}
