import { describe, expect, it } from 'vitest';
import { mergeItems, mergeWire } from './merge';
import type { WireItem } from './schema';
import type { WireExtraction } from './types';

const item = (name: string, price: number | null, opts: string[] = []): WireItem => ({
  name,
  orig: null,
  price,
  cat: 'other',
  opts,
});

function wire(over: Partial<WireExtraction['booth']>, currency: string | null, items: WireItem[]): WireExtraction {
  return {
    booth: { number: null, circle: null, event: null, zone: null, mailOrder: false, ...over },
    currency,
    items,
  };
}

describe('mergeWire', () => {
  it('takes booth fields from the first call that has them', () => {
    const merged = mergeWire([
      wire({ number: 'A-01', circle: null }, null, []),
      wire({ number: 'B-99', circle: 'Moon', zone: 'Hall 2' }, null, []),
      wire({ circle: 'Sun', event: 'SCW' }, null, []),
    ]);
    expect(merged.booth).toEqual({
      number: 'A-01',
      circle: 'Moon',
      event: 'SCW',
      zone: 'Hall 2',
      mailOrder: false,
    });
  });

  it('sets mailOrder when any call reports it', () => {
    expect(mergeWire([wire({}, null, []), wire({ mailOrder: true }, null, [])]).booth.mailOrder).toBe(true);
  });

  it('picks the most frequent currency, breaking ties by first appearance', () => {
    expect(mergeWire([wire({}, 'KRW', []), wire({}, 'JPY', []), wire({}, 'JPY', [])]).currency).toBe('JPY');
    expect(mergeWire([wire({}, null, []), wire({}, 'TWD', []), wire({}, 'CNY', [])]).currency).toBe('TWD');
    expect(mergeWire([wire({}, null, [])]).currency).toBeNull();
  });

  it('dedupes items across images in stable order with options unioned', () => {
    const merged = mergeWire([
      wire({}, 'KRW', [item('Keyring', 5000, ['A']), item('Postcard', 2000)]),
      wire({}, 'KRW', [item('keyring', 5000, ['B']), item('Sticker', 1500)]),
    ]);
    expect(merged.items).toEqual([
      item('Keyring', 5000, ['A', 'B']),
      item('Postcard', 2000),
      item('Sticker', 1500),
    ]);
  });

  it('is deterministic for the same input', () => {
    const input = [wire({ number: '1' }, 'JPY', [item('a', 1)]), wire({}, 'KRW', [item('b', 2)])];
    expect(mergeWire(input)).toEqual(mergeWire(input));
  });

  it('returns an empty extraction for no results', () => {
    expect(mergeWire([])).toEqual(wire({}, null, []));
  });
});

describe('mergeItems', () => {
  it('flattens lists in order', () => {
    expect(mergeItems([[item('x', 1)], [], [item('y', 2), item('X', 1, ['v'])]])).toEqual([
      item('x', 1, ['v']),
      item('y', 2),
    ]);
  });
});
