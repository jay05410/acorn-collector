import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { nanoid } from 'nanoid';
import { normalizeCurrencyCode } from '@/i18n/format';
import { getLanguageInfo } from '@/i18n/state';
import type { Item } from '@/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return nanoid();
}

/** Parses a price field; empty, negative or non-numeric input yields null. */
export function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const price = Number(trimmed);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

/**
 * Currency an event's prices are shown in: its own, else the UI language's
 * default. Every price view resolves it here so they agree.
 */
export function resolveEventCurrency(
  currency: string | null | undefined
): string {
  return normalizeCurrencyCode(currency) ?? getLanguageInfo().defaultCurrency;
}

/**
 * Whether saving an event edit should write the currency picker's value.
 * For an event without a currency the picker shows `seeded` (the UI
 * language's default) only as a display fallback, so it is written only
 * when the user picked something else; a guess is never saved silently.
 */
export function shouldPersistEventCurrency(
  stored: string | null,
  seeded: string,
  selected: string
): boolean {
  return stored !== null || selected !== seeded;
}

/** Currency an item is priced in: its own, else the given fallback. */
export function resolveItemCurrency(
  item: Pick<Item, 'currency'>,
  fallbackCurrency: string
): string {
  return normalizeCurrencyCode(item.currency) ?? fallbackCurrency;
}

export interface CurrencyTotal {
  currency: string;
  /** Sum of price x quantity over priced items. */
  total: number;
  /** Same, over checked items only. */
  spent: number;
}

/**
 * Totals per currency; amounts in different currencies are never added
 * together. The fallback currency is listed first, the rest alphabetically.
 */
export function totalsByCurrency(
  items: readonly Pick<Item, 'price' | 'quantity' | 'checked' | 'currency'>[],
  fallbackCurrency: string
): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const item of items) {
    if (item.price === null) continue;
    const currency = resolveItemCurrency(item, fallbackCurrency);
    const quantity =
      Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const amount = item.price * quantity;
    const entry = totals.get(currency) ?? { currency, total: 0, spent: 0 };
    entry.total += amount;
    if (item.checked) entry.spent += amount;
    totals.set(currency, entry);
  }
  return [...totals.values()].sort((a, b) => {
    if (a.currency === fallbackCurrency) return -1;
    if (b.currency === fallbackCurrency) return 1;
    return a.currency.localeCompare(b.currency);
  });
}
