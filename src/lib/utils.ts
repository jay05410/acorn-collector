import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { nanoid } from 'nanoid';
import { normalizeCurrencyCode } from '@/i18n/format';
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
