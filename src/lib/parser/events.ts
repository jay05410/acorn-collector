/**
 * Event detection (dictionary + edition number) and fuzzy matching against
 * the user's existing events.
 */
import { EVENT_DEFS, type EventCode, type EventDef } from './dictionaries';
import { escapeRegExp, foldKey, normalizeText } from './normalize';

export interface DetectedEvent {
  /** EventDef id, e.g. "comiket". */
  id: string;
  /** Matched text including an edition number or year, e.g. "C108". */
  hint: string;
  /** Edition number or year that followed the name, if any. */
  number?: number;
  index: number;
  end: number;
  generic: boolean;
}

// A number right after an event name is an edition or year ("서코 45회",
// "コミティア150", "Anime Expo 2026") unless it starts a date, time, price,
// day marker or booth ("서코 10/17", "コミケ 2日目", "서코 3,000원").
const NUM_REJECT =
  '(?:[\\d/.:,~%\\-]|[pP](?![A-Za-z])|\\s?(?:[월月日일号號번ホ館馆원円元엔개시時分]|日目|일차))';
const NUM_SUFFIX = `(?:\\s?(?:第\\s?)?(\\d{1,4})(?:\\s?(?:회|回|届|th|st|nd|rd))?(?!${NUM_REJECT}))?`;
const YEAR_OR_EDITION_SUFFIX = `(?:\\s?(\\d{4}|\\d{2})(?![\\d/.:]))?`;

const LATIN_START = /^[A-Za-z]/;
const LATIN_END = /[A-Za-z]$/;

function namePattern(name: string): string {
  const body = name
    .split(/\s+/)
    .map(escapeRegExp)
    .join('[\\s\\-]?');
  const pre = LATIN_START.test(name) ? '(?<![A-Za-z])' : '';
  const post = LATIN_END.test(name) ? '(?![A-Za-z])' : '';
  return `${pre}${body}${post}`;
}

interface Matcher {
  def: EventDef;
  re: RegExp;
  kind: 'name' | 'code' | 'acronym';
  code?: EventCode;
}

function buildMatchers(): Matcher[] {
  const out: Matcher[] = [];
  for (const def of EVENT_DEFS) {
    if (def.names.length > 0) {
      const names = [...def.names].sort((a, b) => b.length - a.length).map(namePattern);
      const prefix = def.takesPrefix ? '(?:([\\p{L}\\p{N}]{1,15})\\s?)?' : '()';
      out.push({
        def,
        kind: 'name',
        re: new RegExp(`${prefix}(?:${names.join('|')})${NUM_SUFFIX}`, 'giu'),
      });
    }
    for (const code of def.codes ?? []) {
      const sep = code.loose ? '[\\s\\-]?' : '';
      out.push({
        def,
        kind: 'code',
        code,
        re: new RegExp(
          `(?<![A-Za-z0-9])()${escapeRegExp(code.prefix)}${sep}(\\d{1,4})(?![0-9A-Za-z]|[.:/]\\d)`,
          'giu'
        ),
      });
    }
    if (def.acronyms && def.acronyms.length > 0) {
      out.push({
        def,
        kind: 'acronym',
        re: new RegExp(
          `(?<![A-Za-z0-9])()(?:${def.acronyms.map(escapeRegExp).join('|')})(?![A-Za-z])${YEAR_OR_EDITION_SUFFIX}`,
          'gu'
        ),
      });
    }
  }
  return out;
}

const MATCHERS = buildMatchers();

const JAPANESE_SCRIPT = /[\u3040-\u30FF]/u;

/**
 * "C" + number is booth-shaped (booth C95 vs Comiket 95). Accept it as
 * Comiket when the post is Japanese, when it is hashtagged, or when the number
 * is a recent edition (C100-C130).
 */
function plausibleCode(
  code: EventCode,
  n: number,
  text: string,
  index: number,
  strict: boolean,
  context: string
): boolean {
  if (n < code.min || n > code.max) return false;
  if (!strict || code.prefix !== 'C') return true;
  if (text[index - 1] === '#') return true;
  if (n >= 100 && n <= 130) return true;
  return JAPANESE_SCRIPT.test(context);
}

/** Every dictionary hit, overlapping ones included. */
function scanEvents(text: string, strict: boolean, context: string = text): DetectedEvent[] {
  const found: DetectedEvent[] = [];
  for (const m of MATCHERS) {
    for (const match of text.matchAll(m.re)) {
      const index = match.index ?? 0;
      const full = match[0];
      if (!full.trim()) continue;
      let number: number | undefined;
      if (m.kind === 'code') {
        const n = Number(match[2]);
        if (!m.code || !plausibleCode(m.code, n, text, index, strict, context)) continue;
        number = n;
      } else {
        const raw = match[2];
        if (raw !== undefined) number = Number(raw);
      }
      // A captured prefix word ("주술" in "주술 온리전") must not be a number.
      if (m.def.takesPrefix && match[1] && /^\d+$/.test(match[1])) continue;
      found.push({
        id: m.def.id,
        hint: full.trim(),
        number,
        index: index + (full.length - full.trimStart().length),
        end: index + full.trimEnd().length,
        generic: m.def.generic === true,
      });
    }
  }
  return found;
}

/**
 * Finds event mentions in normalized text. Overlapping matches keep the
 * longest one ("서울코믹월드" wins over the "코믹월드" inside it). `context` is
 * the whole post when `text` is a fragment (a bracket tag, an author name),
 * used to judge booth-shaped codes like "C95".
 */
export function detectEvents(text: string, context: string = text): DetectedEvent[] {
  return keepLongest(scanEvents(text, true, context));
}

function keepLongest(found: DetectedEvent[]): DetectedEvent[] {
  found.sort((a, b) => a.index - b.index || b.end - b.index - (a.end - a.index));
  const kept: DetectedEvent[] = [];
  for (const ev of found) {
    const overlapping = kept.findIndex((k) => ev.index < k.end && k.index < ev.end);
    if (overlapping === -1) {
      kept.push(ev);
      continue;
    }
    const other = kept[overlapping];
    if (other && ev.end - ev.index > other.end - other.index) kept[overlapping] = ev;
  }
  return kept.sort((a, b) => a.index - b.index);
}

/** Confidence that a detected mention names the post's event. */
export function eventConfidence(ev: DetectedEvent): number {
  if (ev.generic) return ev.number !== undefined ? 0.55 : 0.45;
  return ev.number !== undefined ? 0.85 : 0.7;
}

/** Most specific mention: named over generic, numbered over bare, then first. */
export function pickEvent(events: readonly DetectedEvent[]): DetectedEvent | undefined {
  let best: DetectedEvent | undefined;
  for (const ev of events) {
    if (!best || eventConfidence(ev) > eventConfidence(best)) best = ev;
  }
  return best;
}

// ---------------------------------------------------------------------------
// matchEvent
// ---------------------------------------------------------------------------

export interface EventRef {
  id: string;
  name: string;
}

export interface EventMatch<T extends EventRef = EventRef> {
  event: T;
  /** 0..1; 1 means the same event (same series and edition). */
  score: number;
}

/** Default acceptance threshold, pinned by tests in events.test.ts. */
export const EVENT_MATCH_THRESHOLD = 0.6;

interface Numbers {
  editions: Set<number>;
  years: Set<number>;
}

const DATE_LIKE = [
  /\d{4}\s?[./-]\s?\d{1,2}\s?[./-]\s?\d{1,2}/g,
  /\d{1,2}\s?[./]\s?\d{1,2}(?:\s?[./]\s?\d{2,4})?/g,
  /\d{1,2}\s?(?:월|月)\s?\d{1,2}\s?(?:일|日)?/g,
  /\d{1,2}\s?(?:日目|일차|일째)/g,
  /(?:day|DAY|Day)\s?\d/g,
  /\d{1,2}\s?:\s?\d{2}/g,
];

function extractNumbers(text: string): Numbers {
  const editions = new Set<number>();
  const years = new Set<number>();
  let rest = text;
  // Keep the year of an ISO-like date, drop the rest of any date or time.
  for (const m of text.matchAll(/(\d{4})\s?[./-]\s?\d{1,2}\s?[./-]\s?\d{1,2}/g)) {
    const y = Number(m[1]);
    if (y >= 1990 && y <= 2100) years.add(y);
  }
  for (const re of DATE_LIKE) rest = rest.replace(re, ' ');
  for (const m of rest.matchAll(/\d+/g)) {
    const n = Number(m[0]);
    if (n >= 1990 && n <= 2100) years.add(n);
    else if (n < 1000) editions.add(n);
  }
  return { editions, years };
}

const SEASONS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['spring', ['봄', '春', 'spring', 'haru']],
  ['summer', ['여름', '夏', 'summer']],
  ['autumn', ['가을', '秋', 'autumn', 'fall']],
  ['winter', ['겨울', '冬', 'winter']],
];

function seasonsOf(key: string): Set<string> {
  const out = new Set<string>();
  for (const [season, words] of SEASONS) {
    if (words.some((w) => key.includes(w))) out.add(season);
  }
  return out;
}

function overlaps<T>(a: Set<T>, b: Set<T>): boolean {
  for (const v of a) if (b.has(v)) return true;
  return false;
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const chars = [...s];
  for (let i = 0; i < chars.length - 1; i++) {
    const g = `${chars[i]}${chars[i + 1]}`;
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  let total = 0;
  for (const n of A.values()) total += n;
  for (const n of B.values()) total += n;
  if (total === 0) return 0;
  let common = 0;
  for (const [g, n] of A) common += Math.min(n, B.get(g) ?? 0);
  return (2 * common) / total;
}

function fuzzyScore(a: string, b: string): number {
  const aLen = [...a].length;
  const bLen = [...b].length;
  if (aLen < 2 || bLen < 2) return 0;
  const [short, long, sLen, lLen] = aLen <= bLen ? [a, b, aLen, bLen] : [b, a, bLen, aLen];
  if (long.includes(short)) return 0.5 + 0.45 * (sLen / lLen);
  return 0.9 * dice(a, b);
}

interface Profile {
  key: string;
  /** `key` without generic words (漫展, 온리전, comiccon). */
  residual: string;
  /** Series named by the longest aliases ("서울 코믹월드" -> seoul only). */
  primaryIds: Set<string>;
  /** Every series alias found, nested ones included (+ comic-world). */
  ids: Set<string>;
  genericIds: Set<string>;
  numbers: Numbers;
  seasons: Set<string>;
}

const GENERIC_KEYS = EVENT_DEFS.filter((d) => d.generic)
  .flatMap((d) => d.names.map(foldKey))
  .sort((a, b) => b.length - a.length);

function stripGeneric(key: string): string {
  let out = key;
  for (const g of GENERIC_KEYS) out = out.split(g).join('');
  return out;
}

function profile(text: string): Profile {
  const norm = normalizeText(text);
  const key = foldKey(norm);
  const ids = new Set<string>();
  const genericIds = new Set<string>();
  // Booth-shaped codes count here (strict=false): an event name is known to
  // be an event.
  const all = scanEvents(norm, false);
  for (const ev of all) (ev.generic ? genericIds : ids).add(ev.id);
  const primaryIds = new Set(
    keepLongest([...all])
      .filter((ev) => !ev.generic)
      .map((ev) => ev.id)
  );
  return {
    key,
    residual: stripGeneric(key),
    primaryIds,
    ids,
    genericIds,
    numbers: extractNumbers(norm),
    seasons: seasonsOf(key),
  };
}

function score(hint: Profile, name: Profile): number {
  if (!hint.key || !name.key) return 0;
  if (hint.key === name.key) return 1;

  // A generic word alone ("漫展") must not match every "…漫展 2026"; compare
  // what is left ("주술" of "주술 온리전") instead.
  let s =
    hint.ids.size === 0 && hint.genericIds.size > 0
      ? fuzzyScore(hint.residual, name.residual)
      : fuzzyScore(hint.key, name.key);
  // The hint's own series must appear in the name ("서코" in "서울코믹월드 …");
  // a shared nested alias alone ("코믹월드" in 서울/부산) is weak.
  if (overlaps(hint.primaryIds, name.ids)) s = Math.max(s, 0.75);
  else if (overlaps(hint.ids, name.ids) || overlaps(hint.genericIds, name.genericIds)) s = Math.max(s, 0.5);
  if (s === 0) return 0;

  const { editions: he, years: hy } = hint.numbers;
  const { editions: ne, years: ny } = name.numbers;
  if (he.size > 0 && ne.size > 0) s += overlaps(he, ne) ? 0.25 : -0.45;
  if (hy.size > 0 && ny.size > 0) s += overlaps(hy, ny) ? 0.1 : -0.45;
  if (hint.seasons.size > 0 && name.seasons.size > 0 && !overlaps(hint.seasons, name.seasons)) s -= 0.3;
  return Math.min(1, Math.max(0, s));
}

/**
 * Best existing event for an event hint, or null below the threshold.
 * Handles aliases ("서코" -> "서울코믹월드 2026 가을", "C108" ->
 * "コミックマーケット108") and rejects edition/year/season conflicts
 * ("C107" vs "コミックマーケット108"). Ties keep the earlier event.
 */
export function matchEvent<T extends EventRef>(
  hint: string,
  existingEvents: readonly T[],
  options?: { threshold?: number }
): EventMatch<T> | null {
  const threshold = options?.threshold ?? EVENT_MATCH_THRESHOLD;
  if (!hint.trim() || existingEvents.length === 0) return null;
  const hp = profile(hint);
  let best: EventMatch<T> | null = null;
  for (const event of existingEvents) {
    const s = score(hp, profile(event.name));
    if (!best || s > best.score) best = { event, score: Math.round(s * 100) / 100 };
  }
  return best && best.score >= threshold ? best : null;
}
