import { afterEach, describe, expect, it } from 'vitest';
import { formatPrice, getLanguage, setLanguage } from '@/i18n';
import {
  parsePriceInput,
  resolveEventCurrency,
  resolveItemCurrency,
  shouldPersistEventCurrency,
  totalsByCurrency,
} from './utils';

const initialLanguage = getLanguage();

afterEach(() => {
  setLanguage(initialLanguage);
});

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

describe('resolveEventCurrency', () => {
  it('uses a valid event currency', () => {
    setLanguage('en');
    expect(resolveEventCurrency('twd')).toBe('TWD');
  });

  it('falls back to the UI language default', () => {
    setLanguage('ja');
    expect(resolveEventCurrency(null)).toBe('JPY');
    expect(resolveEventCurrency(undefined)).toBe('JPY');
    expect(resolveEventCurrency('yen' + '!')).toBe('JPY');
  });

  it('gives the checklist and the receipt the same item price', () => {
    // ItemChecklist and ChecklistReceipt both format prices with
    // resolveItemCurrency(item, resolveEventCurrency(event.currency)).
    setLanguage('en');
    const eventCurrency = resolveEventCurrency('KRW');
    const malformed = { currency: 'yen' + '!' };
    expect(
      formatPrice(3000, resolveItemCurrency(malformed, eventCurrency))
    ).toBe(formatPrice(3000, 'KRW'));
    expect(
      formatPrice(500, resolveItemCurrency({ currency: 'JPY' }, eventCurrency))
    ).toBe(formatPrice(500, 'JPY'));
  });
});

describe('shouldPersistEventCurrency', () => {
  it('does not save the display fallback of an event without a currency', () => {
    expect(shouldPersistEventCurrency(null, 'USD', 'USD')).toBe(false);
  });

  it('saves a currency the user picked for an event without one', () => {
    expect(shouldPersistEventCurrency(null, 'USD', 'KRW')).toBe(true);
  });

  it('always saves for an event that already has a currency', () => {
    expect(shouldPersistEventCurrency('TWD', 'TWD', 'TWD')).toBe(true);
    expect(shouldPersistEventCurrency('TWD', 'TWD', 'JPY')).toBe(true);
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
