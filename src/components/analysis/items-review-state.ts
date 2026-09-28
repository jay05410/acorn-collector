/**
 * Row state of the items review list (pure, unit-tested). Rows arrive from
 * the AI stream or a structured source; the user's choices (include, name,
 * price, option, quantity) survive later updates of the same row.
 */
import { normalizeCurrencyCode } from '@/i18n/format';
import type { ExtractedItem } from '@/lib/ai/types';
import {
  generateId,
  parsePriceInput,
  totalsByCurrency,
  type CurrencyTotal,
} from '@/lib/utils';
import { ITEM_CATEGORIES, type Item, type ItemCategory } from '@/types';

/** One incoming row: an AI or prefilled item with a stable key. */
export interface IncomingRow {
  key: string;
  item: ExtractedItem;
  /** Currency of the item's price, when known. */
  currency: string | null;
}

export interface ReviewRow {
  key: string;
  /** Latest data from the source. */
  source: ExtractedItem;
  sourceCurrency: string | null;
  included: boolean;
  /** Edited name; undefined follows the source. */
  name?: string;
  /** Edited price as typed; undefined follows the source. */
  price?: string;
  /** Selected variant; undefined picks the first option. */
  option?: string | null;
  quantity: number;
  /** The user changed something: the row is kept when the source drops it. */
  touched: boolean;
}

export type ReviewAction =
  | { type: 'sync'; rows: readonly IncomingRow[] }
  | { type: 'toggle'; key: string }
  | { type: 'setAll'; included: boolean }
  | {
      type: 'edit';
      key: string;
      patch: Partial<Pick<ReviewRow, 'name' | 'price' | 'option' | 'quantity'>>;
    }
  | { type: 'duplicate'; key: string }
  | { type: 'reset' };

export const MAX_REVIEW_QUANTITY = 999;

function newRow(incoming: IncomingRow): ReviewRow {
  return {
    key: incoming.key,
    source: incoming.item,
    sourceCurrency: incoming.currency,
    included: true,
    quantity: 1,
    touched: false,
  };
}

function baseKey(key: string): string {
  return key.split('#')[0] ?? key;
}

/**
 * Applies a new list from the source. Rows keep their place (a row being
 * edited never jumps): known rows get the new data with the user's edits
 * kept, rows the source no longer has are dropped unless the user touched
 * them, and new rows are appended in source order. Copies made with
 * 'duplicate' follow their original's data.
 */
function sync(rows: readonly ReviewRow[], incoming: readonly IncomingRow[]): ReviewRow[] {
  const byKey = new Map(incoming.map((row) => [row.key, row]));
  const out: ReviewRow[] = [];
  for (const row of rows) {
    const update = byKey.get(baseKey(row.key));
    if (update) {
      out.push({ ...row, source: update.item, sourceCurrency: update.currency });
    } else if (row.touched) {
      out.push(row);
    }
  }
  const present = new Set(out.map((row) => row.key));
  for (const row of incoming) {
    if (!present.has(row.key)) out.push(newRow(row));
  }
  return out;
}

function isSibling(row: ReviewRow, base: string): boolean {
  return row.key === base || row.key.startsWith(`${base}#`);
}

/** Adds a copy of a row right after its last copy, on the next unused option. */
function duplicate(rows: readonly ReviewRow[], key: string): ReviewRow[] {
  const original = rows.find((row) => row.key === key);
  if (!original) return [...rows];
  const base = baseKey(key);
  const used = new Set(rows.filter((row) => isSibling(row, base)).map(selectedOption));
  const nextOption =
    original.source.options.find((option) => !used.has(option)) ?? selectedOption(original);
  const copy: ReviewRow = {
    ...original,
    key: `${base}#${generateId()}`,
    option: nextOption,
    quantity: 1,
    included: true,
    touched: true,
  };
  let last = -1;
  rows.forEach((row, index) => {
    if (isSibling(row, base)) last = index;
  });
  const out = [...rows];
  out.splice(last + 1, 0, copy);
  return out;
}

export function reviewReducer(rows: ReviewRow[], action: ReviewAction): ReviewRow[] {
  switch (action.type) {
    case 'sync':
      return sync(rows, action.rows);
    case 'toggle':
      return rows.map((row) =>
        row.key === action.key ? { ...row, included: !row.included, touched: true } : row
      );
    case 'setAll':
      return rows.map((row) =>
        row.included === action.included ? row : { ...row, included: action.included, touched: true }
      );
    case 'edit':
      return rows.map((row) =>
        row.key === action.key ? { ...row, ...action.patch, touched: true } : row
      );
    case 'duplicate':
      return duplicate(rows, action.key);
    case 'reset':
      return [];
  }
}

// ---------------------------------------------------------------------------
// Derived values

export function rowName(row: ReviewRow): string {
  return row.name ?? row.source.name;
}

export function rowPrice(row: ReviewRow): number | null {
  return row.price === undefined ? row.source.price : parsePriceInput(row.price);
}

export function selectedOption(row: ReviewRow): string | null {
  if (row.option !== undefined) return row.option;
  return row.source.options[0] ?? null;
}

/** The row's currency, falling back to the event's. */
export function rowCurrency(row: ReviewRow, fallback: string): string {
  return normalizeCurrencyCode(row.sourceCurrency) ?? fallback;
}

export function includedRows(rows: readonly ReviewRow[]): ReviewRow[] {
  return rows.filter((row) => row.included && rowName(row).trim() !== '');
}

/** Totals of the included rows per currency, never summed across currencies. */
export function reviewTotals(rows: readonly ReviewRow[], fallback: string): CurrencyTotal[] {
  return totalsByCurrency(
    includedRows(rows).map((row) => ({
      price: rowPrice(row),
      quantity: row.quantity,
      checked: false,
      currency: rowCurrency(row, fallback),
    })),
    fallback
  );
}

const CATEGORY_SET: ReadonlySet<string> = new Set(ITEM_CATEGORIES);

export function validCategory(value: unknown): ItemCategory | null {
  return typeof value === 'string' && CATEGORY_SET.has(value) ? (value as ItemCategory) : null;
}

export interface ItemRecordOptions {
  boothId: string;
  /** Currency of the booth's event; matching items store null. */
  eventCurrency: string;
  badgeId: string;
  now: number;
  makeId?: () => string;
}

/**
 * Items to store for the included rows. The option stays in `option` (never
 * folded into the name); currency is set only when it differs from the
 * event's.
 */
export function toItemRecords(rows: readonly ReviewRow[], options: ItemRecordOptions): Item[] {
  const makeId = options.makeId ?? generateId;
  const eventCurrency = normalizeCurrencyCode(options.eventCurrency) ?? options.eventCurrency;
  return includedRows(rows).map((row, index) => {
    const name = rowName(row).trim();
    const original = row.source.originalName?.trim() || null;
    const currency = rowCurrency(row, eventCurrency);
    return {
      id: makeId(),
      boothId: options.boothId,
      name,
      originalName: original !== null && original !== name ? original : null,
      price: rowPrice(row),
      currency: currency === eventCurrency ? null : currency,
      category: validCategory(row.source.category),
      option: selectedOption(row),
      badgeId: options.badgeId,
      checked: false,
      quantity: Math.min(MAX_REVIEW_QUANTITY, Math.max(1, Math.round(row.quantity) || 1)),
      createdAt: options.now + index,
    };
  });
}

/** Rows for items read without AI (e.g. BOOTH item JSON). */
export function prefilledRows(
  items: readonly ExtractedItem[],
  currency: string | null
): IncomingRow[] {
  return items.map((item, index) => ({
    key: `p${index}`,
    item,
    currency: normalizeCurrencyCode(currency),
  }));
}
