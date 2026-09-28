/**
 * Outbound link extraction, cleaning and classification (order form / info
 * page / other).
 */
import {
  LINK_RULES,
  SHARE_PARAM_SERVICES,
  SOCIAL_SERVICES,
  TRACKING_PARAMS,
  type LinkKind,
} from './dictionaries';
import { escapeRegExp, maskAll, normalizeText } from './normalize';

export type { LinkKind } from './dictionaries';

export interface ClassifiedLink {
  /** Cleaned URL (tracking params removed). */
  url: string;
  kind: LinkKind;
  /** Lowercase host without "www.". */
  host: string;
  /** Known service id such as "witchform" or "google-forms". */
  service?: string;
  /** The post showed a shortened URL ending in "…" and no full link was given. */
  truncated?: boolean;
}

// URL characters stop at whitespace, quotes, brackets and CJK text, because
// CJK posts often glue a URL to the next word ("…/abc에서 주문").
const URL_CHAR =
  "[^\\s<>\"'`{}|\\\\^\\u3000-\\u303F\\p{Script=Hangul}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]";
export const URL_RE = new RegExp(`https?://${URL_CHAR}+`, 'giu');

const BARE_HOSTS = [...new Set(LINK_RULES.filter((r) => r.kind !== 'other').map((r) => r.host))].sort(
  (a, b) => b.length - a.length
);
/**
 * Known form/info hosts written without a scheme, as X displays links. The
 * host must end there: "tally.software" is not "tally.so". Only ASCII
 * continues a host, so "witchform.com에서" still matches.
 */
const BARE_RE = new RegExp(
  `(?<![\\w.@/-])(?:www\\.)?(?:[a-z0-9-]+\\.)*(?:${BARE_HOSTS.map(escapeRegExp).join('|')})` +
    `(?![A-Za-z0-9-]|\\.[A-Za-z0-9])(?:/${URL_CHAR}*)?`,
  'giu'
);

const TRAILING_PUNCT = /[.,!?;:)\]}>'"」』】、。，！？~*]+$/u;
const ELLIPSIS_END = /(?:\.{3}|…)$/u;

function trimUrl(raw: string): { url: string; truncated: boolean } {
  let url = raw;
  const truncated = ELLIPSIS_END.test(url);
  if (truncated) url = url.replace(ELLIPSIS_END, '');
  // Keep a closing paren that balances one inside the URL (wiki-style).
  for (;;) {
    const m = url.match(TRAILING_PUNCT);
    if (!m) break;
    let cut = m[0];
    if (cut.startsWith(')')) {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (opens >= closes) cut = cut.slice(1) || '';
    }
    if (!cut) break;
    url = url.slice(0, url.length - cut.length);
  }
  return { url, truncated };
}

interface ParsedUrl {
  host: string;
  path: string;
}

function parseUrl(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return { host: u.hostname.toLowerCase().replace(/^www\./, ''), path: u.pathname };
  } catch {
    return null;
  }
}

function ruleFor(p: ParsedUrl) {
  return LINK_RULES.find(
    (r) =>
      (p.host === r.host || p.host.endsWith(`.${r.host}`)) &&
      (r.path === undefined || p.path.startsWith(r.path))
  );
}

/**
 * Removes utm_* and known tracking params. `s` / `t` are removed only on
 * social hosts, where they are share tokens. The rest of the URL is kept
 * byte-for-byte (no re-encoding).
 */
export function cleanUrl(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return url;
  const service = ruleFor(parsed)?.service;
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const qAt = beforeHash.indexOf('?');
  if (qAt === -1) return url;
  const base = beforeHash.slice(0, qAt);
  const kept = beforeHash
    .slice(qAt + 1)
    .split('&')
    .filter((pair) => {
      if (!pair) return false;
      const key = decodeKey(pair.split('=')[0] ?? '').toLowerCase();
      if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) return false;
      if ((key === 's' || key === 't') && service && SHARE_PARAM_SERVICES.has(service)) return false;
      return true;
    });
  return `${base}${kept.length ? `?${kept.join('&')}` : ''}${hash}`;
}

function decodeKey(key: string): string {
  try {
    return decodeURIComponent(key.replace(/\+/g, ' '));
  } catch {
    return key;
  }
}

/** Classifies one absolute URL. */
export function classifyUrl(url: string): ClassifiedLink {
  const parsed = parseUrl(url);
  if (!parsed) return { url, kind: 'other', host: '' };
  const rule = ruleFor(parsed);
  return rule
    ? { url, kind: rule.kind, host: parsed.host, service: rule.service }
    : { url, kind: 'other', host: parsed.host };
}

function dedupeKey(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+(?=$|[?#])/, '').toLowerCase();
}

/**
 * All outbound links in first-seen order: full URLs in the text, bare known
 * hosts ("witchform.com/..."), then `extra` (e.g. PageSnapshot.links). A
 * truncated display URL is replaced by the full link it abbreviates.
 */
export function extractLinks(text: string, extra: readonly string[] = []): ClassifiedLink[] {
  const found: Array<{ url: string; truncated: boolean }> = [];
  for (const m of text.matchAll(URL_RE)) found.push(trimUrl(m[0]));
  const withoutUrls = maskAll(text, URL_RE);
  for (const m of withoutUrls.matchAll(BARE_RE)) {
    const t = trimUrl(m[0]);
    const url = `https://${t.url}`;
    // "x.com" in prose is not a link; only keep bare hosts that classify.
    if (classifyUrl(url).kind !== 'other') found.push({ url, truncated: t.truncated });
  }
  const extras = extra
    .map((u) => normalizeText(u).trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .map((u) => cleanUrl(trimUrl(u).url));

  const out: ClassifiedLink[] = [];
  const seen = new Set<string>();
  const push = (url: string, truncated: boolean) => {
    const key = dedupeKey(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const link = classifyUrl(url);
    if (truncated) link.truncated = true;
    out.push(link);
  };

  for (const f of found) {
    const cleaned = cleanUrl(f.url);
    if (f.truncated) {
      const prefix = dedupeKey(cleaned);
      const full = extras.find((e) => dedupeKey(e).startsWith(prefix));
      if (full) {
        push(full, false);
        continue;
      }
    }
    push(cleaned, f.truncated);
  }
  for (const e of extras) push(e, false);
  return out;
}

export interface FormLinks {
  /** Newline-joined URLs, order forms first, then info pages. */
  formUrl?: string;
  confidence: number;
}

/**
 * formUrl = order + info links. When a post links neither, other non-social
 * links are kept (as v1 did) with low confidence, so an unknown shop domain
 * is not silently dropped.
 */
export function pickFormLinks(links: readonly ClassifiedLink[]): FormLinks {
  const order = links.filter((l) => l.kind === 'order');
  const info = links.filter((l) => l.kind === 'info');
  if (order.length || info.length) {
    return {
      formUrl: [...order, ...info].map((l) => l.url).join('\n'),
      confidence: order.length ? 0.9 : 0.7,
    };
  }
  const rest = links.filter((l) => !(l.service && SOCIAL_SERVICES.has(l.service)) && l.host);
  if (rest.length) return { formUrl: rest.map((l) => l.url).join('\n'), confidence: 0.3 };
  return { confidence: 0 };
}
