/**
 * Deterministic merge of per-image extraction calls. Results must be passed
 * in call order: call #1 carries the post text, so its booth fields win.
 */
import { dedupeItems, type WireBooth, type WireItem } from './schema';
import type { WireExtraction } from './types';

type BoothTextField = Exclude<keyof WireBooth, 'mailOrder'>;

function firstNonNull(results: readonly WireExtraction[], field: BoothTextField): string | null {
  for (const result of results) {
    const value = result.booth[field];
    if (value !== null) return value;
  }
  return null;
}

/** Most frequent non-null value; ties go to the value seen first. */
function mostFrequent(values: ReadonlyArray<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Items across calls, deduped by normalized name + price with options unioned. */
export function mergeItems(lists: ReadonlyArray<readonly WireItem[]>): WireItem[] {
  return dedupeItems(lists.flat());
}

export function mergeWire(results: readonly WireExtraction[]): WireExtraction {
  return {
    booth: {
      number: firstNonNull(results, 'number'),
      circle: firstNonNull(results, 'circle'),
      event: firstNonNull(results, 'event'),
      zone: firstNonNull(results, 'zone'),
      mailOrder: results.some((r) => r.booth.mailOrder),
    },
    currency: mostFrequent(results.map((r) => r.currency)),
    items: mergeItems(results.map((r) => r.items)),
  };
}
