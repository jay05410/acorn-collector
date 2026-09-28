/**
 * OpenGraph / meta tag and JSON-LD helpers. The Document-based readers run in
 * the content script; `parseMetaTagsFromHtml` is for the background service
 * worker, which has no DOMParser.
 */

const META_PREFIXES = /^(?:og|article|product|twitter|book|profile|music|video):/;
const MAX_META_ENTRIES = 60;
const MAX_META_VALUE_LENGTH = 2000;
const MAX_JSON_LD_ENTRIES = 20;

function addMeta(out: Record<string, string>, key: string, value: string) {
  const name = key.trim().toLowerCase();
  const content = value.trim();
  if (!content || !META_PREFIXES.test(name) || name in out) return;
  if (Object.keys(out).length >= MAX_META_ENTRIES) return;
  out[name] = content.slice(0, MAX_META_VALUE_LENGTH);
}

/** og:*, article:*, product:*, twitter:* ... (first value per key wins). */
export function readOpenGraph(doc: Document): Record<string, string> {
  const out: Record<string, string> = {};
  for (const meta of doc.querySelectorAll('meta[content]')) {
    const key = meta.getAttribute('property') ?? meta.getAttribute('name');
    const content = meta.getAttribute('content');
    if (key && content) addMeta(out, key, content);
  }
  return out;
}

export function readMetaDescription(doc: Document): string | null {
  const content = doc
    .querySelector('meta[name="description" i]')
    ?.getAttribute('content')
    ?.trim();
  return content || null;
}

export function readMetaAuthor(doc: Document): string | null {
  const content = doc
    .querySelector('meta[name="author" i]')
    ?.getAttribute('content')
    ?.trim();
  return content || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenJsonLd(value: unknown, out: unknown[]): void {
  if (out.length >= MAX_JSON_LD_ENTRIES) return;
  if (Array.isArray(value)) {
    for (const entry of value) flattenJsonLd(entry, out);
    return;
  }
  if (!isObject(value)) return;
  const graph = value['@graph'];
  if (Array.isArray(graph)) {
    flattenJsonLd(graph, out);
    return;
  }
  out.push(value);
}

/** Parsed JSON-LD blocks; `@graph` containers and arrays are flattened. */
export function readJsonLd(doc: Document): unknown[] {
  const out: unknown[] = [];
  const scripts = doc.querySelectorAll('script[type="application/ld+json" i]');
  for (const script of scripts) {
    const source = script.textContent?.trim();
    if (!source) continue;
    try {
      flattenJsonLd(JSON.parse(source), out);
    } catch {
      // Malformed JSON-LD is common; skip the block.
    }
  }
  return out;
}

export interface JsonLdSummary {
  title: string | null;
  description: string | null;
  author: string | null;
  publishedAt: string | null;
  images: string[];
  lang: string | null;
}

/** Types whose fields describe the page's main content, most specific first. */
const PRIMARY_TYPES = [
  'SocialMediaPosting',
  'DiscussionForumPosting',
  'BlogPosting',
  'NewsArticle',
  'Article',
  'Product',
  'Event',
  'CreativeWork',
  'ItemPage',
  'WebPage',
];

function typesOf(entry: Record<string, unknown>): string[] {
  const type = entry['@type'];
  if (typeof type === 'string') return [type];
  return Array.isArray(type)
    ? type.filter((t): t is string => typeof t === 'string')
    : [];
}

function rank(entry: Record<string, unknown>): number {
  const types = typesOf(entry);
  const index = PRIMARY_TYPES.findIndex((type) => types.includes(type));
  return index === -1 ? PRIMARY_TYPES.length : index;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  return null;
}

function nameOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = nameOf(entry);
      if (found) return found;
    }
    return null;
  }
  if (isObject(value)) return firstString(value.name);
  return firstString(value);
}

function imageUrls(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const entry of value) imageUrls(entry, out);
  } else if (isObject(value)) {
    const url = firstString(value.contentUrl) ?? firstString(value.url);
    if (url) out.push(url);
  }
}

function languageOf(value: unknown): string | null {
  if (isObject(value)) {
    return firstString(value.alternateName) ?? firstString(value.name);
  }
  return firstString(value);
}

/** Pull title/author/date/images out of the most relevant JSON-LD entries. */
export function summarizeJsonLd(entries: readonly unknown[]): JsonLdSummary {
  const summary: JsonLdSummary = {
    title: null,
    description: null,
    author: null,
    publishedAt: null,
    images: [],
    lang: null,
  };
  const ranked = entries
    .filter(isObject)
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .filter((candidate) => candidate.rank < PRIMARY_TYPES.length)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((candidate) => candidate.entry);

  for (const entry of ranked) {
    summary.title ??= firstString(entry.headline) ?? firstString(entry.name);
    summary.description ??= firstString(entry.description);
    summary.author ??= nameOf(entry.author) ?? nameOf(entry.creator);
    summary.publishedAt ??=
      firstString(entry.datePublished) ??
      firstString(entry.dateCreated) ??
      firstString(entry.startDate);
    summary.lang ??= languageOf(entry.inLanguage);
    imageUrls(entry.image, summary.images);
    imageUrls(entry.thumbnailUrl, summary.images);
  }
  return summary;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode the HTML entities that appear in attribute values and API text. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,6}));/gi,
    (match, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
      if (dec !== undefined || hex !== undefined) {
        const code = dec !== undefined ? Number(dec) : parseInt(hex ?? '', 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[(name ?? '').toLowerCase()] ?? match;
    }
  );
}

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([^\s=/<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g;
/** Meta tags live in <head>; never scan more than this much markup. */
const MAX_HTML_SCAN = 512 * 1024;

/**
 * Regex-based meta tag reader for contexts without a DOM (service worker).
 * Returns the same key space as `readOpenGraph`.
 */
export function parseMetaTagsFromHtml(html: string): Record<string, string> {
  const headEnd = html.search(/<\/head>/i);
  const head = html.slice(0, headEnd === -1 ? MAX_HTML_SCAN : headEnd);
  const out: Record<string, string> = {};
  for (const tag of head.match(META_TAG) ?? []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(ATTRIBUTE)) {
      const name = match[1]?.toLowerCase();
      if (!name || name in attributes) continue;
      attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
    }
    const key = attributes.property ?? attributes.name;
    const content = attributes.content;
    if (key && content) addMeta(out, key, content);
  }
  return out;
}
