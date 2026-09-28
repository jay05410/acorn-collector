import { getLanguageInfo } from './state';

const CURRENCY_CODE = /^[A-Z]{3}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Upper-cased ISO 4217 code, or null when the input is not a 3-letter code. */
export function normalizeCurrencyCode(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return CURRENCY_CODE.test(upper) ? upper : null;
}

const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<F extends Intl.NumberFormat | Intl.DateTimeFormat>(
  key: string,
  create: () => F
): F {
  let formatter = formatters.get(key) as F | undefined;
  if (!formatter) {
    formatter = create();
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatNumber(value: number): string {
  const { intlLocale } = getLanguageInfo();
  return cached(
    `n|${intlLocale}`,
    () => new Intl.NumberFormat(intlLocale)
  ).format(value);
}

/**
 * Localized price. `currency` falls back to the UI language's default
 * currency when missing or malformed. Whole amounts drop the minor unit
 * ("$5", "NT$120") because event prices are almost always integers.
 */
export function formatPrice(
  amount: number | null,
  currency?: string | null
): string {
  if (amount === null || !Number.isFinite(amount)) return '';
  const { intlLocale, defaultCurrency } = getLanguageInfo();
  const code = normalizeCurrencyCode(currency) ?? defaultCurrency;
  const whole = Number.isInteger(amount);
  return cached(
    `c|${intlLocale}|${code}|${whole ? 'w' : 'f'}`,
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: code,
        ...(whole
          ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          : {}),
      })
  ).format(amount);
}

/** Parses "YYYY-MM-DD" as a local calendar date; undefined if invalid. */
export function parseIsoDate(value: string): Date | undefined {
  const match = ISO_DATE.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day;
  return valid ? date : undefined;
}

/** Formats a local calendar date as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Localized date (e.g. "Oct 3, 2026" in English). Date-only strings are
 * read as local dates so they never shift by a day; other ISO strings go
 * through Date. Unparseable input is returned unchanged.
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = parseIsoDate(isoDate) ?? new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const { intlLocale } = getLanguageInfo();
  return cached(
    `d|${intlLocale}`,
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
  ).format(date);
}
