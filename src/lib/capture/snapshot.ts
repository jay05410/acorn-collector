/**
 * PageSnapshot construction and normalization. Every snapshot passes through
 * `normalizeSnapshot` so limits (text, links, images) hold no matter which
 * extractor or enrichment produced it.
 */
import { filterImages } from './images';
import type { CapturedImage, PageSnapshot, SiteId } from './types';
import { hostOf, isNullableString, isRecord } from './util';

export const MAX_TEXT_LENGTH = 8000;
export const MAX_LINKS = 20;
const MAX_TITLE_LENGTH = 300;
const MAX_AUTHOR_FIELD_LENGTH = 200;
/** Serialized JSON-LD budget; pages can embed whole product catalogs. */
const MAX_JSON_LD_CHARS = 30_000;
const MAX_JSON_LD_ENTRIES = 20;

function onDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

const SITE_DOMAINS: ReadonlyArray<readonly [SiteId, readonly string[]]> = [
  ['x', ['x.com', 'twitter.com']],
  ['bluesky', ['bsky.app']],
  ['booth', ['booth.pm']],
  ['instagram', ['instagram.com']],
  ['threads', ['threads.net', 'threads.com']],
  ['pixiv', ['pixiv.net']],
  ['witchform', ['witchform.com']],
];

export function detectSite(url: string): SiteId {
  const host = hostOf(url);
  if (!host) return 'generic';
  for (const [site, domains] of SITE_DOMAINS) {
    if (domains.some((domain) => onDomain(host, domain))) return site;
  }
  return 'generic';
}

const TRACKING_PARAMS: readonly RegExp[] = [
  /^utm_/i,
  /^(?:fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|twclid)$/i,
  /^mc_(?:cid|eid)$/i,
  /^igsh(?:id)?$/i,
  /^ref_(?:src|url)$/i,
  /^_hs(?:enc|mi)$/i,
];
/** X share links append `s` (client) and `t` (tracking token). */
const X_TRACKING_PARAMS = new Set(['s', 't']);

function decodeParamName(segment: string): string {
  const name = segment.split('=')[0] ?? '';
  try {
    return decodeURIComponent(name.replace(/\+/g, ' '));
  } catch {
    return name;
  }
}

/**
 * Remove known tracking parameters. Other parameters keep their original
 * encoding (rebuilding via URLSearchParams would re-encode them).
 */
export function stripTrackingParams(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const query = parsed.search.slice(1);
  if (!query) return parsed.href;
  const isX = detectSite(parsed.href) === 'x';
  const segments = query.split('&');
  const kept = segments.filter((segment) => {
    const name = decodeParamName(segment);
    if (isX && X_TRACKING_PARAMS.has(name)) return false;
    return !TRACKING_PARAMS.some((pattern) => pattern.test(name));
  });
  if (kept.length === segments.length) return parsed.href;
  parsed.search = kept.length ? `?${kept.join('&')}` : '';
  return parsed.href;
}

/** Resolve against `base`, keep http(s) only and strip tracking params. */
export function cleanUrl(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url.trim(), base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return stripTrackingParams(parsed.href);
  } catch {
    return null;
  }
}

function withoutHash(url: string): string {
  const index = url.indexOf('#');
  return index === -1 ? url : url.slice(0, index);
}

/** Absolute, deduped, tracking-free links, excluding the page itself. */
export function normalizeLinks(
  links: readonly string[],
  pageUrl: string,
  limit: number = MAX_LINKS
): string[] {
  const page = cleanUrl(pageUrl);
  const pageKey = page ? withoutHash(page) : null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const link of links) {
    const cleaned = cleanUrl(link, pageUrl);
    if (!cleaned || withoutHash(cleaned) === pageKey) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= limit) break;
  }
  return result;
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let end = limit - 1;
  const code = text.charCodeAt(end - 1);
  // Do not split a surrogate pair.
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

/**
 * Collapse horizontal whitespace, trim lines, keep at most one blank line
 * between paragraphs and cap the length.
 */
export function normalizeText(
  text: string,
  limit: number = MAX_TEXT_LENGTH
): string {
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return truncate(cleaned, limit);
}

function optionalText(
  value: string | null | undefined,
  limit: number
): string | null {
  if (!value) return null;
  const normalized = normalizeText(value, limit);
  return normalized || null;
}

function singleLine(value: string | null | undefined, limit: number): string {
  return value ? truncate(value.replace(/\s+/g, ' ').trim(), limit) : '';
}

const LANG_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
/** Undetermined, no linguistic content, multiple, and private-use (qaa-qtz). */
const NON_LANGUAGE = /^(?:und|zxx|mul|mis|q[a-t][a-z])$/i;

/** Accept BCP 47-like tags ("ja", "zh-TW", "en_US"); reject placeholders. */
export function normalizeLang(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const candidate = tag.trim().replace(/_/g, '-');
  if (!LANG_TAG.test(candidate)) return null;
  const [primary = '', ...rest] = candidate.split('-');
  if (NON_LANGUAGE.test(primary)) return null;
  return [primary.toLowerCase(), ...rest].join('-');
}

function normalizePublished(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && !Number.isNaN(Date.parse(trimmed)) ? trimmed : null;
}

function normalizeAuthor(
  author: PageSnapshot['author'] | undefined
): PageSnapshot['author'] {
  if (!author) return null;
  const name = singleLine(author.name, MAX_AUTHOR_FIELD_LENGTH) || null;
  const handle = singleLine(author.handle, MAX_AUTHOR_FIELD_LENGTH) || null;
  const url = author.url ? cleanUrl(author.url) : null;
  return name || handle || url ? { name, handle, url } : null;
}

function capJsonLd(entries: readonly unknown[]): unknown[] {
  const kept: unknown[] = [];
  let budget = MAX_JSON_LD_CHARS;
  for (const entry of entries.slice(0, MAX_JSON_LD_ENTRIES)) {
    let size: number;
    try {
      size = JSON.stringify(entry)?.length ?? 0;
    } catch {
      continue;
    }
    if (size === 0 || size > budget) continue;
    budget -= size;
    kept.push(entry);
  }
  return kept;
}

function normalizeStructured(
  structured: PageSnapshot['structured'] | undefined
): PageSnapshot['structured'] {
  if (!structured) return null;
  const jsonLd = capJsonLd(structured.jsonLd);
  const openGraph = { ...structured.openGraph };
  return jsonLd.length || Object.keys(openGraph).length
    ? { jsonLd, openGraph }
    : null;
}

function comparable(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Enforce every PageSnapshot invariant. Idempotent. */
export function normalizeSnapshot(snapshot: PageSnapshot): PageSnapshot {
  const url = cleanUrl(snapshot.url) ?? snapshot.url;
  const text = normalizeText(snapshot.text);
  const displayed = optionalText(snapshot.displayedText, MAX_TEXT_LENGTH);
  const prefilled = snapshot.prefilledItems?.length
    ? snapshot.prefilledItems
    : null;
  const currency = snapshot.prefilledCurrency?.trim().toUpperCase() ?? '';
  return {
    version: 1,
    capturedAt: snapshot.capturedAt,
    site: snapshot.site,
    url,
    canonicalUrl: snapshot.canonicalUrl
      ? cleanUrl(snapshot.canonicalUrl, url)
      : null,
    title: singleLine(snapshot.title, MAX_TITLE_LENGTH),
    lang: normalizeLang(snapshot.lang),
    author: normalizeAuthor(snapshot.author),
    text,
    displayedText:
      displayed && comparable(displayed) !== comparable(text)
        ? displayed
        : null,
    selection: optionalText(snapshot.selection, MAX_TEXT_LENGTH),
    images: filterImages(snapshot.images),
    links: normalizeLinks(snapshot.links, url),
    publishedAt: normalizePublished(snapshot.publishedAt),
    structured: normalizeStructured(snapshot.structured),
    prefilledItems: prefilled,
    prefilledCurrency: prefilled && /^[A-Z]{3}$/.test(currency) ? currency : null,
  };
}

export type SnapshotInput = Partial<
  Omit<PageSnapshot, 'version' | 'url' | 'capturedAt'>
> & {
  url: string;
  capturedAt: number;
};

/** Build a normalized snapshot; unspecified fields get empty defaults. */
export function createSnapshot(input: SnapshotInput): PageSnapshot {
  return normalizeSnapshot({
    version: 1,
    site: input.site ?? detectSite(input.url),
    canonicalUrl: null,
    title: '',
    lang: null,
    author: null,
    text: '',
    displayedText: null,
    selection: null,
    images: [],
    links: [],
    publishedAt: null,
    structured: null,
    prefilledItems: null,
    prefilledCurrency: null,
    ...input,
  });
}

/** Put `leading` images first, keeping the rest (deduped and capped). */
export function withLeadingImages(
  snapshot: PageSnapshot,
  leading: readonly CapturedImage[]
): PageSnapshot {
  if (!leading.length) return snapshot;
  return normalizeSnapshot({
    ...snapshot,
    images: [...leading, ...snapshot.images],
  });
}

/** Structural check for snapshots crossing a process boundary. */
export function isPageSnapshot(value: unknown): value is PageSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.capturedAt === 'number' &&
    typeof value.site === 'string' &&
    typeof value.url === 'string' &&
    isNullableString(value.canonicalUrl) &&
    typeof value.title === 'string' &&
    isNullableString(value.lang) &&
    (value.author === null || isRecord(value.author)) &&
    typeof value.text === 'string' &&
    isNullableString(value.displayedText) &&
    isNullableString(value.selection) &&
    Array.isArray(value.images) &&
    value.images.every((image) => isRecord(image) && typeof image.url === 'string') &&
    Array.isArray(value.links) &&
    value.links.every((link) => typeof link === 'string') &&
    isNullableString(value.publishedAt) &&
    (value.structured === null || isRecord(value.structured)) &&
    (value.prefilledItems === null || Array.isArray(value.prefilledItems)) &&
    isNullableString(value.prefilledCurrency)
  );
}
