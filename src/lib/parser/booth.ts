/**
 * Booth / space number recognition for ko, ja, zh and en posts.
 *
 * Candidates are collected from several grammars and ranked by specificity:
 *   bracket "[서코/B-12]", "【C108 1日目 東ホ-12a】"          0.85-0.95
 *   label   "부스 B-12", "スペース：西あ-05b", "攤位 K32"      0.7-0.9
 *   Comiket "東ホ-12a", "南ア01ab", "東7ホール ア-12b"          0.88
 *   hall    "홀1-B32", "3号馆 F19"                              0.8
 *   kana    "き18a" (COMITIA style, needs the a/b suffix)       0.75
 *   bare    "A-01", "B12", "AA-214"                             0.6 +/- context
 * Event codes (C108, CP29, FF42), URLs, handles and hashtags are masked
 * first, and bare codes are filtered for dates, sizes, ratings and prices.
 */
import { detectEvents, type DetectedEvent } from './events';
import { URL_RE } from './links';
import { lineBounds, maskAll, maskRange, normalizeText } from './normalize';

export type BoothSource = 'bracket' | 'label' | 'comiket' | 'hall' | 'kana' | 'alnum' | 'author' | 'mail-order';

export interface BoothCandidate {
  /** Normalized code, e.g. "B-12", "東ホ-12a", "홀1-B32". */
  value: string;
  source: BoothSource;
  confidence: number;
  /** Offset in the normalized text. */
  index: number;
  /** Event text found next to the code in a bracket tag ("서코45"). */
  eventHint?: string;
}

// ---------------------------------------------------------------------------
// Grammar (regex sources; no capturing groups inside these fragments)
// ---------------------------------------------------------------------------

const KANA = 'ぁ-ゖァ-ヺ';

const DAY_PREFIX =
  '(?:(?<!\\d)[1-4]\\s?(?:日目|일차|일째)|(?<![A-Za-z])[Dd][Aa][Yy]\\s?-?\\s?[1-4](?!\\d)|' +
  '第[一二三四1-4][天日]|[土日金]曜日?|[토일금]요일|(?:周|週|星期|禮拜|礼拜)[五六日天])';

/** Tokyo Big Sight style: hall + block + number + a/b half. */
const COMIKET =
  `(?:東|西|南|北)\\s?(?:\\d{1,2}\\s?(?:ホール)?\\s?)?[${KANA}A-Za-z]\\s?-?\\s?\\d{1,2}(?:[abAB]{1,2})?(?![A-Za-z0-9])`;

const HALL = '(?:홀\\s?\\d{1,2}|\\d{1,2}\\s?홀|[Hh]all\\s?\\d{1,2}|HALL\\s?\\d{1,2}|\\d{1,2}\\s?(?:号馆|號館|号館|館|馆))';

const ALNUM_CORE = '[A-Za-z]{1,2}(?:\\s?-\\s?)?\\d{1,3}(?:[ab]{1,2})?';
/** "A-01~02", "B12&13", "B12-13". */
const ALNUM_RANGE = '(?:\\s?[~&・]\\s?(?:[A-Za-z]{1,2}(?:\\s?-\\s?)?)?\\d{1,3}(?:[ab]{1,2})?|-\\d{1,3}(?:[ab]{1,2})?)?';
const ALNUM_TAIL = '(?![A-Za-z0-9_]|[.:/,]\\d|%)';
const ALNUM = `${ALNUM_CORE}${ALNUM_RANGE}${ALNUM_TAIL}`;

const KANA_BLOCK = `[${KANA}]\\s?-?\\s?\\d{1,2}(?:[ab]{1,2})?(?![A-Za-z0-9])`;
/** Unlabeled kana blocks need the a/b half so "あ12" in prose is ignored. */
const KANA_BLOCK_STRICT = `(?<![${KANA}ー])[${KANA}]\\s?-?\\s?\\d{1,2}[ab]{1,2}(?![A-Za-z0-9])`;
const HANGUL_BLOCK = '[가-힣]-?\\d{1,3}(?![0-9A-Za-z]|\\s?[만천원円元개시분월일%])';
const DIGITS =
  '#?\\d{1,4}[A-Za-z]?(?![A-Za-z0-9/.:,~%\\-]|\\s?(?:[시時分분원円元개월月일日]|日目|일차|[ap]m(?![a-z])))';

const CODE_LABELED = `(?:${COMIKET}|${HALL}\\s?-?\\s?${ALNUM}|${ALNUM}|${KANA_BLOCK}|${HANGUL_BLOCK}|${DIGITS})`;

const LABEL_WORDS = [
  '부스\\s?번호',
  '부스',
  '스페이스',
  'サークルスペース',
  'スペース',
  '配置',
  'ブース',
  '摊位号',
  '攤位號',
  '攤位号',
  '摊位',
  '攤位',
  '攤號',
  '摊号',
  '位置',
  'booth(?:\\s?(?:no\\.?|number|#))?',
  'table(?:\\s?(?:no\\.?|number|#))?',
  'space',
].join('|');

/** Labels that are specific enough to accept a bare number ("Booth #1234"). */
const DIGIT_LABEL = /^(?:부스|booth|table|ブース|摊|攤)/iu;
/** "Booth 2026 신청" is a year; "Booth #2026", "Booth No. 2026", "부스 번호 2026", "2026번" are booths. */
const YEAR_LIKE = /^(?:19|20)\d{2}$/;
const NUMBER_MARK = /#|(?<![A-Za-z])(?:no\.?|number)(?![A-Za-z])|번/iu;

const LABEL_RE = new RegExp(
  `(?<![A-Za-z])(${LABEL_WORDS})\\s?(?:[:=]|は|는|은|번호)?\\s?(?:(?:no\\.?|#)\\s?)?(?:(${DAY_PREFIX})\\s?)?(${CODE_LABELED})`,
  'giu'
);

const SUFFIX_RE = new RegExp(
  `(?<![A-Za-z0-9_@#/.:\\-])((?:${HALL}\\s?-?\\s?)?${ALNUM_CORE}${ALNUM_RANGE})\\s?(?:번\\s?)?(?:부스|ブース|摊位|攤位|booth)(?![A-Za-z])`,
  'giu'
);

const BRACKET_RE = /[[【〔〖]([^[\]【】〔〕〖〗\n]{1,80})[\]】〕〗]/gu;
const BRACKET_CODE_RE = new RegExp(
  `(?<![A-Za-z0-9])(?:(${DAY_PREFIX})\\s?)?(${COMIKET}|(?:${HALL}\\s?-?\\s?)?${ALNUM}|${KANA_BLOCK})`,
  'gu'
);
const DAY_RE = new RegExp(DAY_PREFIX, 'gu');

const COMIKET_RE = new RegExp(`(?:(${DAY_PREFIX})\\s?)?(${COMIKET})`, 'gu');
const HALL_RE = new RegExp(`(?<![A-Za-z0-9])(${HALL}\\s?-?\\s?${ALNUM})`, 'gu');
const KANA_RE = new RegExp(`(${KANA_BLOCK_STRICT})`, 'gu');
const ALNUM_RE = new RegExp(`(?<![A-Za-z0-9_@#/.:&=?%+\\-])(${ALNUM})`, 'gu');

// The lookbehind anchors matches to token starts, keeping this linear.
const EMAIL_RE = /(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
const HANDLE_RE = /@[A-Za-z0-9_]{1,30}/gu;
const HASHTAG_RE = /#[^\s#]+/gu;
const PRICE_RE =
  /(?:[$¥₩€£₱]|NT\$|HK\$|US\$|S\$|RM|Rp)\s?\d|\d[\d,.]*\s?(?:원|円|엔|元|塊|块|yen|won|usd|twd|jpy|krw|rmb|myr|php|idr)(?![A-Za-z])/iu;
const BOOTH_WORDS = /부스|booth|table|スペース|ブース|摊位|攤位|配置/iu;

/**
 * Two-letter and one-letter prefixes that are almost never booth blocks when
 * written bare: times (PM1), counts (x2), ratings (R18), versions (v2), pages
 * (P12), currencies (RM15, NT150), media (EP3, CH12) and event codes.
 */
const BLOCKED_PREFIXES = new Set([
  'AM', 'PM', 'NO', 'EP', 'CH', 'RM', 'NT', 'HK', 'US', 'SG', 'TW', 'JP', 'KR', 'CN',
  'PS', 'HP', 'MP', 'LV', 'OP', 'ED', 'CP', 'FF', 'AX', 'BW', 'CF', 'PF', 'WF', 'KG',
  'CM', 'MM', 'ML', 'GB', 'MB', 'KB', 'TB', 'VR', 'AR', 'SS', 'HD', 'FT', 'ID', 'DM',
  'MV', 'PV', 'X', 'V', 'R', 'P', 'Q',
]);

// ---------------------------------------------------------------------------
// Formatting and filters
// ---------------------------------------------------------------------------

/** "b - 12A" -> "B-12a"; keeps kana, hangul and hall prefixes as written. */
export function formatBoothCode(raw: string): string {
  return raw
    .replace(/^#/, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*~\s*/g, '~')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?<![A-Za-z])[A-Za-z]{1,2}(?=-?\d)/g, (m) => m.toUpperCase())
    .replace(/(\d)([abAB]{1,2})(?![A-Za-z])/g, (_m, d: string, ab: string) => d + ab.toLowerCase());
}

function leadingLetters(value: string): string {
  return (value.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
}

/** Bare-code filters: returns false for sizes, ratings, countdowns, etc. */
function plausibleBare(value: string): boolean {
  const letters = leadingLetters(value);
  if (!letters || BLOCKED_PREFIXES.has(letters)) return false;
  if (/^[AB]\d$/.test(value)) return false; // paper sizes A4, B5
  if (/^D-[1-9]\d{0,2}$/.test(value)) return false; // Korean countdown D-7
  return true;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/** Blanks URLs, e-mail addresses and @handles, keeping offsets. */
export function maskLinksAndHandles(text: string): string {
  return maskAll(maskAll(maskAll(text, URL_RE), EMAIL_RE), HANDLE_RE);
}

function maskEvents(text: string, events: readonly DetectedEvent[]): string {
  let out = text;
  for (const ev of events) out = maskRange(out, ev.index, ev.end);
  return out;
}

const NON_EVENT_TAGS =
  /^(?:공지|신간|구간|굿즈|인포|안내|통판|선입금|예약|판매|구매|재판|rt|info|notice|new|sale|wip|告知|お知らせ|新刊|既刊|おしながき|お品書き|通販|頒布|公告|通贩|预售|預購|新品)$/iu;
const BRACKET_LABEL_WORDS = /부스|스페이스|booth|table|space|スペース|ブース|配置|摊位号?|攤位號?/giu;

function bracketEventPart(content: string, codeStart: number, codeEnd: number): string {
  const rest = maskRange(content, codeStart, codeEnd)
    .replace(DAY_RE, ' ')
    .replace(BRACKET_LABEL_WORDS, ' ')
    .replace(/[/|,、・:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
  return rest;
}

function scanBrackets(text: string): BoothCandidate[] {
  const out: BoothCandidate[] = [];
  for (const b of text.matchAll(BRACKET_RE)) {
    const content = b[1] ?? '';
    const contentStart = (b.index ?? 0) + 1;
    const events = detectEvents(content, text);
    const masked = maskEvents(content, events);
    for (const m of masked.matchAll(BRACKET_CODE_RE)) {
      const code = m[2];
      if (!code) continue;
      const codeStart = (m.index ?? 0) + (m[0].length - code.length);
      const value = formatBoothCode(code);
      const part = bracketEventPart(content, m.index ?? 0, (m.index ?? 0) + m[0].length);
      const known = events.some((e) => !e.generic);
      const tagged = part && !NON_EVENT_TAGS.test(part) ? part : undefined;
      const isAlnum = /^[A-Za-z]/.test(value);
      if (isAlnum && !known && !plausibleBare(value)) continue;
      out.push({
        value,
        source: 'bracket',
        confidence: known ? 0.95 : tagged ? 0.9 : 0.85,
        index: contentStart + codeStart,
        eventHint: tagged,
      });
      break;
    }
  }
  return out;
}

function scanLabels(text: string): BoothCandidate[] {
  const out: BoothCandidate[] = [];
  for (const m of text.matchAll(LABEL_RE)) {
    const label = m[1] ?? '';
    const code = m[3];
    if (!code) continue;
    const digitsOnly = /^#?\d/.test(code);
    if (digitsOnly && !DIGIT_LABEL.test(label)) continue;
    if (YEAR_LIKE.test(code)) {
      const end = (m.index ?? 0) + m[0].length;
      if (!NUMBER_MARK.test(m[0]) && !/^\s?번/u.test(text.slice(end, end + 2))) continue;
    }
    const hangul = /^[가-힣]/.test(code);
    out.push({
      value: formatBoothCode(code),
      source: 'label',
      confidence: digitsOnly ? 0.7 : hangul ? 0.8 : 0.9,
      index: (m.index ?? 0) + m[0].length - code.length,
    });
  }
  for (const m of text.matchAll(SUFFIX_RE)) {
    const code = m[1];
    if (!code) continue;
    out.push({ value: formatBoothCode(code), source: 'label', confidence: 0.85, index: m.index ?? 0 });
  }
  return out;
}

function scanShapes(text: string, eventLines: ReadonlySet<number>): BoothCandidate[] {
  const out: BoothCandidate[] = [];
  for (const m of text.matchAll(COMIKET_RE)) {
    const code = m[2];
    if (!code) continue;
    out.push({
      value: formatBoothCode(code),
      source: 'comiket',
      confidence: 0.88,
      index: (m.index ?? 0) + m[0].length - code.length,
    });
  }
  for (const m of text.matchAll(HALL_RE)) {
    const code = m[1];
    if (code) out.push({ value: formatBoothCode(code), source: 'hall', confidence: 0.8, index: m.index ?? 0 });
  }
  for (const m of text.matchAll(KANA_RE)) {
    const code = m[1];
    if (code) out.push({ value: formatBoothCode(code), source: 'kana', confidence: 0.75, index: m.index ?? 0 });
  }

  const bare: BoothCandidate[] = [];
  const lineFlags = new Map<number, { price: boolean; boothWord: boolean }>();
  for (const m of text.matchAll(ALNUM_RE)) {
    const code = m[1];
    if (!code) continue;
    const value = formatBoothCode(code);
    if (!plausibleBare(value)) continue;
    const index = m.index ?? 0;
    const [ls, le] = lineBounds(text, index);
    let flags = lineFlags.get(ls);
    if (!flags) {
      const line = text.slice(ls, le);
      flags = { price: PRICE_RE.test(line), boothWord: BOOTH_WORDS.test(line) };
      lineFlags.set(ls, flags);
    }
    let confidence = 0.6;
    if (/^[A-Za-z]{1,2}-?0\d/.test(value)) confidence += 0.05; // zero padded: A01
    if (/^[A-Za-z]{2}\d$/.test(value)) confidence *= 0.6; // ZB1, UR3: names and ranks, not blocks
    if (eventLines.has(ls) || flags.boothWord) confidence += 0.1;
    if (flags.price) confidence *= 0.6; // "A-1 아크릴 5,000원"
    bare.push({ value, source: 'alnum', confidence, index });
  }
  // Three or more bare codes with one prefix are an item list (A-1, A-2, A-3).
  const byPrefix = new Map<string, Set<string>>();
  for (const c of bare) {
    const key = leadingLetters(c.value);
    const set = byPrefix.get(key) ?? new Set<string>();
    set.add(c.value);
    byPrefix.set(key, set);
  }
  for (const c of bare) {
    if ((byPrefix.get(leadingLetters(c.value))?.size ?? 0) >= 3) c.confidence *= 0.6;
    out.push(c);
  }
  return out;
}

const FULL_CODE_RE = new RegExp(
  `^(?:${COMIKET}|(?:${HALL}\\s?-?\\s?)?${ALNUM}|${KANA_BLOCK}|${HANGUL_BLOCK}|#?\\d{1,4}[A-Za-z]?)$`,
  'u'
);

/** True when the whole string is a booth code in one of the grammars above. */
export function isBoothCode(value: string): boolean {
  return FULL_CODE_RE.test(normalizeText(value).trim());
}

/** Minimum confidence for a candidate to become `boothNumber`. */
export const BOOTH_MIN_CONFIDENCE = 0.4;

/**
 * Ranked booth candidates for normalized text, best first. Candidates whose
 * span overlaps a stronger one are dropped, and equal values are merged.
 */
export function findBoothCandidates(text: string, events: readonly DetectedEvent[]): BoothCandidate[] {
  const noLinks = maskLinksAndHandles(text);
  const noEvents = maskEvents(noLinks, events);
  const bare = maskAll(noEvents, HASHTAG_RE);
  const eventLines = new Set(events.map((e) => lineBounds(text, e.index)[0]));

  const all = [...scanBrackets(noLinks), ...scanLabels(noEvents), ...scanShapes(bare, eventLines)];
  all.sort((a, b) => b.confidence - a.confidence || a.index - b.index);

  const kept: Array<BoothCandidate & { end: number }> = [];
  const values = new Set<string>();
  for (const c of all) {
    const end = c.index + c.value.length;
    if (values.has(c.value)) continue;
    if (kept.some((k) => c.index < k.end && k.index < end)) continue;
    values.add(c.value);
    kept.push({ ...c, end });
  }
  return kept.map(({ end: _end, ...c }) => ({ ...c, confidence: Math.round(c.confidence * 100) / 100 }));
}
