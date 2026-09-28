/**
 * Sales-channel and schedule signals: mail order, pre-order vs on-site, and
 * which day of a multi-day event.
 */
import {
  MAIL_ORDER_TERMS,
  ONSITE_TERMS,
  PICKUP_TERMS,
  PREORDER_EN_TERMS,
  PREORDER_TERMS,
  SHIPPING_TERMS,
  ZONE_KEYWORDS,
} from './dictionaries';
import { escapeRegExp } from './normalize';

function termPattern(term: string): string {
  const body = term.split(/\s+/).map(escapeRegExp).join('\\s?');
  const pre = /^[A-Za-z]/.test(term) ? '(?<![A-Za-z])' : '';
  const post = /[A-Za-z]$/.test(term) ? '(?![A-Za-z])' : '';
  return `${pre}${body}${post}`;
}

function termsRegex(terms: readonly string[]): RegExp {
  const sorted = [...terms].sort((a, b) => b.length - a.length).map(termPattern);
  return new RegExp(`(?:${sorted.join('|')})`, 'giu');
}

// Negation right after a term: "통판 없음", "통판은 안 해요", "通販なし",
// "通販予定はありません", "通贩：无", "mail order: not available".
const NEG_AFTER = new RegExp(
  '^[\\s:=\\-은는이가도의はもの]*' +
    '(?:(?:예정|계획|予定|计划|計畫)\\s?(?:은|는|이|は|も)?\\s?)?' +
    '(?:없|안\\s?(?:해|하|함|합)|하지\\s?않|불가|미정|X(?![A-Za-z])|✕|✖|❌|×|' +
    'なし|無し|ありません|しません|しない|未定|不可|无(?!料)|無(?!料)|不(?:提供|开放|開放|接受|做)|没有|沒有|暂无|暫無|' +
    'not\\s|unavailable|n/a(?![A-Za-z])|closed)',
  'iu'
);
// Negation right before a term: "no mail order", "不做通贩", "無通販".
const NEG_BEFORE = new RegExp(
  '(?:(?<![A-Za-z])(?:no|not|without|won\'t|will not|don\'t|do not|isn\'t|aren\'t|never)\\s+(?:be\\s+)?' +
    '(?:doing\\s+|offering\\s+|accepting\\s+|taking\\s+|opening\\s+|any\\s+)?|' +
    '(?:不做|不开|不開|不提供|没有|沒有|暂无|暫無|无|無)\\s?)$',
  'iu'
);

function isNegated(text: string, index: number, end: number): boolean {
  const lineEnd = text.indexOf('\n', end);
  const after = text.slice(end, Math.min(lineEnd === -1 ? text.length : lineEnd, end + 16));
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const before = text.slice(Math.max(lineStart, index - 24), index);
  return NEG_AFTER.test(after) || NEG_BEFORE.test(before);
}

function firstPositive(text: string, re: RegExp): RegExpMatchArray | undefined {
  for (const m of text.matchAll(re)) {
    const index = m.index ?? 0;
    if (!isNegated(text, index, index + m[0].length)) return m;
  }
  return undefined;
}

function hasPositive(text: string, re: RegExp): boolean {
  return firstPositive(text, re) !== undefined;
}

const MAIL_ORDER_RES = MAIL_ORDER_TERMS.map((g) => ({ ...g, re: termsRegex(g.terms) }));
const PREORDER_EN_RE = termsRegex(PREORDER_EN_TERMS);
const PREORDER_RE = termsRegex(PREORDER_TERMS);
const ONSITE_RE = termsRegex(ONSITE_TERMS);
const PICKUP_RE = termsRegex(PICKUP_TERMS);
const SHIPPING_RE = termsRegex(SHIPPING_TERMS);

export interface MailOrderSignal {
  isMailOrder: boolean;
  /** Booth-number fallback for mail-order-only posts ("통판", "通販", ...). */
  label?: string;
  confidence: number;
}

/**
 * Explicit mail-order words (통판, 通販, 通贩, mail order, online shop) set the
 * flag unless negated. English "pre-order" sets it only when nothing says the
 * order is picked up at the event, and either shipping is mentioned or the
 * post has no physical booth.
 */
export function detectMailOrder(text: string, hasPhysicalBooth: boolean): MailOrderSignal {
  let best: { index: number; label: string } | undefined;
  for (const g of MAIL_ORDER_RES) {
    const m = firstPositive(text, g.re);
    if (m && (!best || (m.index ?? 0) < best.index)) best = { index: m.index ?? 0, label: g.label };
  }
  if (best) return { isMailOrder: true, label: best.label, confidence: 0.85 };

  if (hasPositive(text, PREORDER_EN_RE) && !hasPositive(text, PICKUP_RE)) {
    if (hasPositive(text, SHIPPING_RE) || !hasPhysicalBooth) {
      return { isMailOrder: true, label: 'Mail order', confidence: 0.6 };
    }
  }
  return { isMailOrder: false, confidence: 0 };
}

export type SaleMode = 'preorder' | 'onsite' | 'both';

/** Pre-order (선입금, 予約, 预售, pre-order) vs on-site (현장판매, 当日頒布, 现场). */
export function detectSaleMode(text: string): SaleMode | undefined {
  const pre = hasPositive(text, PREORDER_RE);
  const onsite = hasPositive(text, ONSITE_RE);
  if (pre && onsite) return 'both';
  if (pre) return 'preorder';
  if (onsite) return 'onsite';
  return undefined;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySignal {
  /** The day marker as written (normalized), e.g. "2日目", "Day 2", "토요일". */
  dayHint?: string;
  /** 1-based day of a multi-day event, when written as an ordinal. */
  dayIndex?: number;
  weekday?: Weekday;
}

const ORDINAL_WORDS: Record<string, number> = {
  첫: 1,
  둘: 2,
  셋: 3,
  넷: 4,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
};

const ORDINAL_PATTERNS: readonly RegExp[] = [
  /(?<!\d)([1-4])\s?日目/u,
  /(?<!\d)([1-4])\s?(?:일차|일째)/u,
  /(첫|둘|셋|넷)째\s?날/u,
  /(?<![A-Za-z])day\s?-?\s?([1-4])(?![0-9])/iu,
  /第\s?([一二三四1-4])\s?[天日](?!本)/u,
];

const WEEKDAY_MAP: Record<string, Weekday> = {
  월: 'mon',
  화: 'tue',
  수: 'wed',
  목: 'thu',
  금: 'fri',
  토: 'sat',
  일: 'sun',
  月: 'mon',
  火: 'tue',
  水: 'wed',
  木: 'thu',
  金: 'fri',
  土: 'sat',
  日: 'sun',
  一: 'mon',
  二: 'tue',
  三: 'wed',
  四: 'thu',
  五: 'fri',
  六: 'sat',
  天: 'sun',
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

// zh: 周一..周六 are Monday..Saturday, 周日 / 周天 is Sunday. After a count
// the word means "week(s)": "一周三次" (three times a week), "2周一次". A date
// right before it is not a count: "10/3周六".
const WEEK_COUNT = '(?<![一二三四五六七八九十两兩]|(?<![\\d/.\\-])\\d+)';
const WEEKDAY_PATTERNS: readonly RegExp[] = [
  /([월화수목금토일])요일/u,
  /([月火水木金土日])曜日?/u,
  new RegExp(`${WEEK_COUNT}(?:星期|週|周|禮拜|礼拜)([一二三四五六日天])`, 'u'),
  /(?<![A-Za-z])(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?![A-Za-z])/iu,
];

function firstMatch(text: string, patterns: readonly RegExp[]): RegExpMatchArray | undefined {
  let best: RegExpMatchArray | undefined;
  for (const re of patterns) {
    const m = text.match(re);
    if (m && (!best || (m.index ?? 0) < (best.index ?? 0))) best = m;
  }
  return best;
}

export function detectDay(text: string): DaySignal {
  const out: DaySignal = {};
  const ordinal = firstMatch(text, ORDINAL_PATTERNS);
  if (ordinal) {
    const raw = ordinal[1] ?? '';
    const n = ORDINAL_WORDS[raw] ?? Number(raw);
    if (n >= 1 && n <= 4) out.dayIndex = n;
    out.dayHint = ordinal[0].replace(/\s+/g, ' ').trim();
  }
  const weekdayMatch = firstMatch(text, WEEKDAY_PATTERNS);
  const weekday = weekdayMatch ? WEEKDAY_MAP[(weekdayMatch[1] ?? '').toLowerCase()] : undefined;
  if (weekday && weekdayMatch) {
    out.weekday = weekday;
    if (!out.dayHint) out.dayHint = weekdayMatch[0].trim();
  }
  return out;
}

const ZONE_RE = new RegExp(`(${ZONE_KEYWORDS.map(escapeRegExp).join('|')})`, 'iu');

export function detectZone(text: string): string | undefined {
  return text.match(ZONE_RE)?.[1];
}
