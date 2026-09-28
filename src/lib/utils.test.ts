import { describe, expect, it } from 'vitest';
import {
  parsePriceInput,
  resolveItemCurrency,
  totalsByCurrency,
} from './utils';

describe('parsePriceInput', () => {
  it('parses integers and decimals', () => {
    expect(parsePriceInput('3000')).toBe(3000);
    expect(parsePriceInput(' 12.5 ')).toBe(12.5);
    expect(parsePriceInput('0')).toBe(0);
  });

  it('returns null for empty, negative or invalid input', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('  ')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
  });
});

describe('resolveItemCurrency', () => {
  it('prefers a valid item currency', () => {
    expect(resolveItemCurrency({ currency: 'jpy' }, 'KRW')).toBe('JPY');
  });

  it('falls back when the item has none or a malformed one', () => {
    expect(resolveItemCurrency({ currency: null }, 'KRW')).toBe('KRW');
    expect(resolveItemCurrency({ currency: 'yen' + '!' }, 'KRW')).toBe('KRW');
  });
});

describe('totalsByCurrency', () => {
  const item = (
    price: number | null,
    currency: string | null,
    checked = false,
    quantity = 1
  ) => ({ price, currency, checked, quantity });

  it('never adds different currencies together', () => {
    const totals = totalsByCurrency(
      [
        item(3000, null, true),
        item(500, 'JPY'),
        item(2000, 'KRW', false, 2),
        item(10, 'USD', true),
        item(null, 'EUR'),
      ],
      'KRW'
    );

    expect(totals).toEqual([
      { currency: 'KRW', total: 7000, spent: 3000 },
      { currency: 'JPY', total: 500, spent: 0 },
      { currency: 'USD', total: 10, spent: 10 },
    ]);
  });

  it('treats missing or invalid quantities as one', () => {
    expect(
      totalsByCurrency(
        [item(100, null, true, 0), item(100, null, false, Number.NaN)],
        'TWD'
      )
    ).toEqual([{ currency: 'TWD', total: 200, spent: 100 }]);
  });

  it('returns nothing when no item has a price', () => {
    expect(totalsByCurrency([item(null, null)], 'USD')).toEqual([]);
  });
});
