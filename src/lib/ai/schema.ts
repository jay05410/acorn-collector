/**
 * Wire schema every provider is constrained to, plus the validation that turns
 * untrusted model output into a clean `WireExtraction` and then into the
 * app-facing `ExtractionResult`.
 */
// The submodule, not '@/i18n': the barrel pulls in React.
import { normalizeCurrencyCode } from '@/i18n/format';
import { ITEM_CATEGORIES, type ItemCategory } from '@/types';
import { isRecord } from './guards';
import {
  AIError,
  type ExtractedItem,
  type ExtractionMeta,
  type ExtractionResult,
  type ProviderId,
  type WireExtraction,
} from './types';

/** Bump when WIRE_SCHEMA or the prompt changes meaning (invalidates the cache). */
export const SCHEMA_VERSION = 1;

export type WireItem = WireExtraction['items'][number];
export type WireBooth = WireExtraction['booth'];

/** JSON Schema object as sent to providers. */
export type JsonSchema = { readonly [key: string]: unknown };

export const WIRE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['booth', 'currency', 'items'],
  properties: {
    booth: {
      type: 'object',
      additionalProperties: false,
      required: ['number', 'circle', 'event', 'zone', 'mailOrder'],
      properties: {
        number: { type: ['string', 'null'] },
        circle: { type: ['string', 'null'] },
        event: { type: ['string', 'null'] },
        zone: { type: ['string', 'null'] },
        mailOrder: { type: 'boolean' },
      },
    },
    currency: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'orig', 'price', 'cat', 'opts'],
        properties: {
          name: { type: 'string' },
          orig: { type: ['string', 'null'] },
          price: { type: ['number', 'null'] },
          cat: { type: 'string', enum: ITEM_CATEGORIES },
          opts: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const satisfies JsonSchema;

/**
 * Rewrites `type: [T, 'null']` into `anyOf: [{type: T}, {type: 'null'}]`.
 * Anthropic's structured outputs document `anyOf` and `null` but not type
 * arrays, so Claude-backed requests use this equivalent form.
 */
export function nullableTypesToAnyOf(schema: JsonSchema): JsonSchema {
  const out: Record<string, unknown> = { ...schema };
  if (isRecord(schema.properties)) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        isRecord(value) ? nullableTypesToAnyOf(value) : value,
      ])
    );
  }
  if (isRecord(schema.items)) out.items = nullableTypesToAnyOf(schema.items);

  const type = schema.type;
  if (Array.isArray(type) && type.length === 2 && type.includes('null')) {
    const { type: _type, ...rest } = out;
    return {
      anyOf: [{ ...rest, type: type.find((t) => t !== 'null') }, { type: 'null' }],
    };
  }
  return out;
}

export const WIRE_SCHEMA_ANY_OF: JsonSchema = nullableTypesToAnyOf(WIRE_SCHEMA);

export type SchemaStyle = 'type-array' | 'any-of';

export function wireSchema(style: SchemaStyle): JsonSchema {
  return style === 'any-of' ? WIRE_SCHEMA_ANY_OF : WIRE_SCHEMA;
}

// ---------------------------------------------------------------------------
// Validation

const CATEGORY_SET: ReadonlySet<string> = new Set(ITEM_CATEGORIES);
const GROUPED_THOUSANDS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const PLAIN_NUMBER = /^\d+(?:\.\d+)?$/;

function cleanString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** Accepts numbers and numeric strings such as "3,000", "¥800" or "1500 yen" written with the yen kanji. */
export function coercePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  let digits = value.replace(/[^\d.,]/g, '');
  if (GROUPED_THOUSANDS.test(digits)) digits = digits.replace(/,/g, '');
  return PLAIN_NUMBER.test(digits) ? Number(digits) : null;
}

function coerceCategory(value: unknown): ItemCategory {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CATEGORY_SET.has(key) ? (key as ItemCategory) : 'other';
}

function coerceCurrency(value: unknown): string | null {
  return typeof value === 'string' ? normalizeCurrencyCode(value) : null;
}

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeName(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Normalization used for dedupe keys: NFKC, lower case, no whitespace,
 * punctuation or symbols (a title with and without corner brackets collides).
 */
export function normalizeName(name: string): string {
  const folded = name.normalize('NFKC').toLowerCase();
  const stripped = folded.replace(/[\s\p{P}\p{S}]+/gu, '');
  return stripped === '' ? folded.trim() : stripped;
}

/** Normalizes one untrusted item; null when it has no usable name. */
export function normalizeWireItem(raw: unknown): WireItem | null {
  if (!isRecord(raw)) return null;
  const name = cleanString(raw.name);
  if (name === null) return null;
  const orig = cleanString(raw.orig);
  const opts = Array.isArray(raw.opts)
    ? raw.opts.map(cleanString).filter((o): o is string => o !== null)
    : [];
  return {
    name,
    orig: orig === name ? null : orig,
    price: coercePrice(raw.price),
    cat: coerceCategory(raw.cat),
    opts: uniqueStrings(opts),
  };
}

function itemKey(item: WireItem): string {
  return `${normalizeName(item.name)}|${item.price ?? ''}`;
}

/**
 * Collapses items with the same normalized name and price, keeping the first
 * occurrence's position and unioning options. Stable and deterministic.
 */
export function dedupeItems(items: Iterable<WireItem>): WireItem[] {
  const byKey = new Map<string, WireItem>();
  for (const item of items) {
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, opts: [...item.opts] });
      continue;
    }
    existing.opts = uniqueStrings([...existing.opts, ...item.opts]);
    existing.orig ??= item.orig;
    if (existing.cat === 'other') existing.cat = item.cat;
  }
  return [...byKey.values()];
}

function normalizeBooth(raw: unknown): WireBooth {
  const booth = isRecord(raw) ? raw : {};
  return {
    number: cleanString(booth.number),
    circle: cleanString(booth.circle),
    event: cleanString(booth.event),
    zone: cleanString(booth.zone),
    mailOrder: booth.mailOrder === true,
  };
}

/** Validates and normalizes untrusted wire output. Throws AIError('bad_response'). */
export function validateWire(raw: unknown, provider?: ProviderId): WireExtraction {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new AIError('bad_response', 'Model output does not match the extraction schema', provider);
  }
  const items = raw.items.map(normalizeWireItem).filter((i): i is WireItem => i !== null);
  return {
    booth: normalizeBooth(raw.booth),
    currency: coerceCurrency(raw.currency),
    items: dedupeItems(items),
  };
}

/** Parses the model's final JSON text. Throws AIError('bad_response'). */
export function parseWireJson(text: string, provider: ProviderId): WireExtraction {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AIError('bad_response', 'Model output is not valid JSON', provider);
  }
  return validateWire(raw, provider);
}

// ---------------------------------------------------------------------------
// Wire -> app types

export function toExtractedItem(item: WireItem): ExtractedItem {
  return {
    name: item.name,
    originalName: item.orig,
    price: item.price,
    category: item.cat,
    options: [...item.opts],
  };
}

export function toResult(wire: WireExtraction, meta: ExtractionMeta): ExtractionResult {
  return {
    booth: {
      boothNumber: wire.booth.number,
      circleName: wire.booth.circle,
      eventName: wire.booth.event,
      zone: wire.booth.zone,
      isMailOrder: wire.booth.mailOrder,
    },
    currency: wire.currency,
    items: wire.items.map(toExtractedItem),
    meta,
  };
}
