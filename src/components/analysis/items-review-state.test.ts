import { describe, expect, it } from 'vitest';
import type { ExtractedItem } from '@/lib/ai/types';
import {
  currencyUnknown,
  includedRows,
  knownItemKey,
  prefilledRows,
  reviewReducer,
  reviewTotals,
  rowCurrency,
  rowName,
  rowPrice,
  selectedOption,
  toItemRecords,
  type IncomingRow,
  type ReviewRow,
} from './items-review-state';

function item(name: string, price: number | null, patch: Partial<ExtractedItem> = {}): ExtractedItem {
  return { name, originalName: null, price, category: 'other', options: [], ...patch };
}

function incoming(key: string, it: ExtractedItem, currency: string | null = 'KRW'): IncomingRow {
  return { key, item: it, currency };
}

function synced(rows: IncomingRow[], state: ReviewRow[] = []): ReviewRow[] {
  return reviewReducer(state, { type: 'sync', rows });
}

describe('reviewReducer sync', () => {
  it('adds new rows included, with the first option and quantity 1', () => {
    const rows = synced([incoming('a', item('Keyring', 5000, { options: ['A', 'B'] }))]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'a', included: true, quantity: 1, touched: false });
    expect(selectedOption(rows[0]!)).toBe('A');
  });

  it('keeps user edits when the same row updates', () => {
    let rows = synced([incoming('a', item('Keyring', 5000))]);
    rows = reviewReducer(rows, { type: 'edit', key: 'a', patch: { name: 'My keyring', quantity: 2 } });
    rows = reviewReducer(rows, { type: 'toggle', key: 'a' });
    rows = synced([incoming('a', item('Acrylic keyring', 5500))], rows);
    expect(rowName(rows[0]!)).toBe('My keyring');
    expect(rowPrice(rows[0]!)).toBe(5500);
    expect(rows[0]).toMatchObject({ quantity: 2, included: false });
  });

  it('places new rows at their source position', () => {
    let rows = synced([incoming('0:a', item('A', 1)), incoming('1:c', item('C', 1))]);
    rows = synced(
      [incoming('0:a', item('A', 1)), incoming('0:b', item('B', 1)), incoming('1:c', item('C', 1))],
      rows
    );
    expect(rows.map((r) => r.key)).toEqual(['0:a', '0:b', '1:c']);
  });

  it('keeps a touched row the source dropped at its place', () => {
    let rows = synced([incoming('a', item('A', 1)), incoming('b', item('B', 1)), incoming('c', item('C', 1))]);
    rows = reviewReducer(rows, { type: 'edit', key: 'b', patch: { quantity: 2 } });
    rows = synced([incoming('a', item('A', 1)), incoming('c', item('C', 1))], rows);
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c']);
  });

  it('starts items the booth already has excluded', () => {
    const rows = reviewReducer([], {
      type: 'sync',
      rows: [
        incoming('a', item('Keyring', 5000)),
        incoming('b', item('Book', 800, { originalName: 'Hon' })),
        incoming('c', item('New', 100)),
      ],
      known: new Set([knownItemKey('keyring', 5000), knownItemKey('Hon', 800)]),
    });
    expect(rows.map((r) => [r.key, r.included, r.known ?? false])).toEqual([
      ['a', false, true],
      ['b', false, true],
      ['c', true, false],
    ]);
  });

  it('drops rows the source no longer has unless the user touched them', () => {
    let rows = synced([incoming('a', item('A', 1)), incoming('b', item('B', 1))]);
    rows = reviewReducer(rows, { type: 'edit', key: 'b', patch: { price: '900' } });
    rows = synced([], rows);
    expect(rows.map((r) => r.key)).toEqual(['b']);
    expect(rowPrice(rows[0]!)).toBe(900);
  });

  it('keeps untouched rows the source dropped when not pruning (a re-run under way)', () => {
    let rows = synced([incoming('a', item('A', 1)), incoming('b', item('B', 1))]);
    rows = reviewReducer(rows, { type: 'sync', rows: [incoming('b', item('B', 2))], prune: false });
    expect(rows.map((r) => [r.key, rowPrice(r)])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    rows = reviewReducer(rows, { type: 'sync', rows: [incoming('b', item('B', 2))] });
    expect(rows.map((r) => r.key)).toEqual(['b']);
  });
});

describe('reviewReducer bulk and duplicate', () => {
  it('selects all and none', () => {
    let rows = synced([incoming('a', item('A', 1)), incoming('b', item('B', 1))]);
    rows = reviewReducer(rows, { type: 'setAll', included: false });
    expect(includedRows(rows)).toHaveLength(0);
    rows = reviewReducer(rows, { type: 'setAll', included: true });
    expect(includedRows(rows)).toHaveLength(2);
  });

  it('duplicates a row onto the next unused option, next to it', () => {
    let rows = synced([
      incoming('a', item('Badge', 400, { options: ['A', 'B', 'C'] })),
      incoming('z', item('Other', 100)),
    ]);
    rows = reviewReducer(rows, { type: 'duplicate', key: 'a' });
    rows = reviewReducer(rows, { type: 'duplicate', key: 'a' });
    expect(rows.map((r) => selectedOption(r))).toEqual(['A', 'B', 'C', null]);
    expect(rows[3]?.key).toBe('z');
    // Copies follow their original's data on later updates.
    rows = synced(
      [incoming('a', item('Can badge', 450, { options: ['A', 'B', 'C'] })), incoming('z', item('Other', 100))],
      rows
    );
    expect(rows.slice(0, 3).map((r) => rowPrice(r))).toEqual([450, 450, 450]);
  });
});

describe('duplicate copies', () => {
  it('tracks copies explicitly, even when a source key contains #', () => {
    // normalizeName keeps symbol-only names, so an AI key can be "0:#|500".
    const key = '0:#|500';
    let rows = synced([incoming(key, item('#', 500, { options: ['A', 'B'] }))]);
    rows = reviewReducer(rows, { type: 'toggle', key });
    rows = reviewReducer(rows, { type: 'duplicate', key });
    expect(rows.map((r) => [r.copyOf ?? null, selectedOption(r)])).toEqual([
      [null, 'A'],
      [key, 'B'],
    ]);
    // Stream updates keep exactly one original and its copy.
    for (let i = 0; i < 3; i++) {
      rows = synced([incoming(key, item('#', 500 + i, { options: ['A', 'B'] }))], rows);
    }
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(rows.map((r) => rowPrice(r))).toEqual([502, 502]);
  });

  it('copies of a copy belong to the original', () => {
    let rows = synced([incoming('a', item('Badge', 400, { options: ['A', 'B', 'C'] }))]);
    rows = reviewReducer(rows, { type: 'duplicate', key: 'a' });
    rows = reviewReducer(rows, { type: 'duplicate', key: rows[1]!.key });
    expect(rows.map((r) => [r.copyOf ?? null, selectedOption(r)])).toEqual([
      [null, 'A'],
      ['a', 'B'],
      ['a', 'C'],
    ]);
  });
});

describe('row currency', () => {
  it('is unknown until the source or the user sets it, and saves in the event currency meanwhile', () => {
    let rows = synced([{ key: 'a', item: item('Book', 800), currency: undefined }]);
    const [row] = rows;
    expect(row?.sourceCurrency).toBeUndefined();
    expect(currencyUnknown(row!)).toBe(true);
    expect(rowCurrency(row!, 'KRW')).toBe('KRW');
    const options = { boothId: 'b1', eventCurrency: 'KRW', badgeId: 'x', now: 1 };
    expect(toItemRecords(rows, options)[0]?.currency).toBeNull();

    rows = reviewReducer(rows, { type: 'edit', key: 'a', patch: { currency: 'JPY' } });
    expect(currencyUnknown(rows[0]!)).toBe(false);
    expect(toItemRecords(rows, options)[0]?.currency).toBe('JPY');
    // The choice survives later updates, even once the source knows a currency.
    rows = synced([incoming('a', item('Book', 800), 'KRW')], rows);
    expect(rowCurrency(rows[0]!, 'KRW')).toBe('JPY');
  });

  it('treats a null source currency as known (none), priced in the event currency', () => {
    const [row] = synced([incoming('a', item('Book', 800), null)]);
    expect(currencyUnknown(row!)).toBe(false);
    expect(rowCurrency(row!, 'TWD')).toBe('TWD');
  });
});

describe('reviewTotals', () => {
  it('sums price x quantity per currency over included rows only', () => {
    let rows = synced([
      incoming('a', item('A', 5000), 'KRW'),
      incoming('b', item('B', 800), 'JPY'),
      incoming('c', item('C', 400), 'JPY'),
      incoming('d', item('D', null), 'KRW'),
    ]);
    rows = reviewReducer(rows, { type: 'edit', key: 'b', patch: { quantity: 2 } });
    rows = reviewReducer(rows, { type: 'toggle', key: 'c' });
    expect(reviewTotals(rows, 'KRW')).toEqual([
      { currency: 'KRW', total: 5000, spent: 0 },
      { currency: 'JPY', total: 1600, spent: 0 },
    ]);
  });

  it('uses the fallback currency for rows without one', () => {
    const rows = synced([incoming('a', item('A', 10), null)]);
    expect(reviewTotals(rows, 'TWD')).toEqual([{ currency: 'TWD', total: 10, spent: 0 }]);
  });
});

describe('toItemRecords', () => {
  const options = { boothId: 'b1', eventCurrency: 'KRW', badgeId: 'pickup', now: 100 };

  it('stores currency only when it differs from the event currency', () => {
    const rows = synced([
      incoming('k', item('Keyring', 5000), 'KRW'),
      incoming('j', item('Book', 800, { originalName: 'Hon' }), 'JPY'),
    ]);
    let n = 0;
    const records = toItemRecords(rows, { ...options, makeId: () => `id${++n}` });
    expect(records).toEqual([
      {
        id: 'id1',
        boothId: 'b1',
        name: 'Keyring',
        originalName: null,
        price: 5000,
        currency: null,
        category: 'other',
        option: null,
        badgeId: 'pickup',
        checked: false,
        quantity: 1,
        createdAt: 100,
      },
      expect.objectContaining({ name: 'Book', originalName: 'Hon', currency: 'JPY', createdAt: 101 }),
    ]);
  });

  it('keeps the option separate from the name and validates the category', () => {
    let rows = synced([
      incoming('a', item('Badge', 400, { options: ['A', 'B'], category: 'nope' as never })),
    ]);
    rows = reviewReducer(rows, { type: 'edit', key: 'a', patch: { option: 'B', quantity: 3 } });
    const [record] = toItemRecords(rows, options);
    expect(record).toMatchObject({ name: 'Badge', option: 'B', category: null, quantity: 3 });
  });

  it('skips excluded and nameless rows and drops an originalName equal to the name', () => {
    let rows = synced([
      incoming('a', item('A', 1, { originalName: 'A' })),
      incoming('b', item('B', 1)),
      incoming('c', item('C', 1)),
    ]);
    rows = reviewReducer(rows, { type: 'toggle', key: 'b' });
    rows = reviewReducer(rows, { type: 'edit', key: 'c', patch: { name: '   ' } });
    const records = toItemRecords(rows, options);
    expect(records.map((r) => [r.name, r.originalName])).toEqual([['A', null]]);
  });

  it('parses edited prices and clamps quantities', () => {
    let rows = synced([incoming('a', item('A', 1))]);
    rows = reviewReducer(rows, { type: 'edit', key: 'a', patch: { price: '', quantity: 5000 } });
    expect(toItemRecords(rows, options)[0]).toMatchObject({ price: null, quantity: 999 });
  });
});

describe('prefilledRows', () => {
  it('keys prefilled items and normalizes their currency', () => {
    expect(prefilledRows([item('A', 1)], 'jpy')).toEqual([
      { key: 'p0', item: item('A', 1), currency: 'JPY' },
    ]);
  });
});
