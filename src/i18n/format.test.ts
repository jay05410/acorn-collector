import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatDate,
  formatPrice,
  normalizeCurrencyCode,
  parseIsoDate,
  toIsoDate,
} from './format';
import { getLanguage, setLanguage } from './state';
import type { AppLanguage } from './languages';

let initial: AppLanguage;

beforeEach(() => {
  initial = getLanguage();
  setLanguage('en');
});

afterEach(() => {
  setLanguage(initial);
});

describe('normalizeCurrencyCode', () => {
  it('upper-cases and trims ISO codes', () => {
    expect(normalizeCurrencyCode(' twd ')).toBe('TWD');
  });

  it('rejects anything that is not a 3-letter code', () => {
    expect(normalizeCurrencyCode('₩')).toBeNull();
    expect(normalizeCurrencyCode('WON1')).toBeNull();
    expect(normalizeCurrencyCode('')).toBeNull();
    expect(normalizeCurrencyCode(null)).toBeNull();
  });
});

describe('formatPrice', () => {
  it('returns an empty string for missing amounts', () => {
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(Number.NaN, 'USD')).toBe('');
  });

  it('uses the given currency in the current locale', () => {
    expect(formatPrice(5, 'USD')).toBe('$5');
    expect(formatPrice(12.5, 'USD')).toBe('$12.50');
    expect(formatPrice(3000, 'KRW')).toBe('₩3,000');
  });

  it('falls back to the language default currency', () => {
    setLanguage('ko');
    expect(formatPrice(3000)).toBe('₩3,000');
    expect(formatPrice(3000, null)).toBe('₩3,000');
    setLanguage('zh-TW');
    expect(formatPrice(120, 'bad!')).toBe(formatPrice(120, 'TWD'));
  });

  it('follows the current locale for foreign currencies', () => {
    setLanguage('ja');
    expect(formatPrice(1500, 'JPY')).toBe(
      new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1500)
    );
    setLanguage('ko');
    expect(formatPrice(5, 'usd')).toBe('US$5');
  });
});

describe('parseIsoDate / toIsoDate', () => {
  it('round-trips a calendar date without timezone shifts', () => {
    const date = parseIsoDate('2026-10-03');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(3);
    expect(toIsoDate(date as Date)).toBe('2026-10-03');
  });

  it('rejects impossible or malformed dates', () => {
    expect(parseIsoDate('2026-02-31')).toBeUndefined();
    expect(parseIsoDate('2026-2-3')).toBeUndefined();
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDate', () => {
  it('formats date-only strings in the current locale', () => {
    expect(formatDate('2026-10-03')).toBe('Oct 3, 2026');
    setLanguage('ko');
    expect(formatDate('2026-10-03')).toBe('2026년 10월 3일');
  });

  it('accepts full ISO timestamps', () => {
    expect(formatDate(new Date(2026, 9, 3, 15).toISOString())).toBe(
      'Oct 3, 2026'
    );
  });

  it('returns empty or unparseable input unchanged', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('soon')).toBe('soon');
  });
});
