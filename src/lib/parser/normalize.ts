/**
 * Text normalization shared by the static judgment parser.
 *
 * Everything here is pure and allocation-light: the parser runs on every
 * capture, before (or instead of) any AI call.
 */

/** Dash-like code points that people use interchangeably in booth codes. */
const DASHES = /[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D]/g;
/** Tilde-like range separators. */
const TILDES = /[\u301C\u3030\uFF5E\u223C\u02DC]/g;
/** Ideographic space and other exotic spaces (NFKC keeps some of them). */
const SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const ZERO_WIDTH = /[\u200B\u200C\u2060\uFEFF]/g;

/**
 * NFKC (full-width ASCII -> half-width, half-width kana -> full-width kana,
 * compatibility forms), unified dashes and tildes, plain spaces.
 * Length may change, so offsets always refer to the normalized string.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(SPACES, ' ')
    .replace(DASHES, '-')
    .replace(TILDES, '~')
    .replace(/\r\n?/g, '\n');
}

const FOLD_STRIP = /[\p{P}\p{S}\p{Z}\s\p{Cc}\p{Cf}]+/gu;

/**
 * Comparison key: NFKC, lowercase, without spaces, punctuation or symbols.
 * "서울 코믹월드 2026·가을" -> "서울코믹월드2026가을".
 */
export function foldKey(text: string): string {
  return normalizeText(text).toLowerCase().replace(FOLD_STRIP, '');
}

const EMOJI =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20E3\uFE0E\uFE0F\u200D]/gu;

/** Removes emoji, skin tones, variation selectors and ZWJ sequences. */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI, '');
}

/** Collapses runs of horizontal whitespace and trims. */
export function collapseSpaces(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim();
}

/** Replaces [start, end) with spaces so later regexes keep their offsets. */
export function maskRange(text: string, start: number, end: number): string {
  if (end <= start) return text;
  return text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
}

/** Masks every match of a global regex with spaces. */
export function maskAll(text: string, re: RegExp): string {
  return text.replace(re, (m) => ' '.repeat(m.length));
}

/** Escapes a literal for use inside a RegExp source. */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Line (0-based) containing `index`, as [start, end) offsets. */
export function lineBounds(text: string, index: number): [number, number] {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const nl = text.indexOf('\n', index);
  return [start, nl === -1 ? text.length : nl];
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Rounds to 2 decimals so confidences are stable in snapshots and UI. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
