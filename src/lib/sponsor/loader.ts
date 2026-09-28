/**
 * Sponsor feed loader: a plain JSON download from a static host with no
 * cookies, no query parameters and no identifiers, cached in
 * chrome.storage.local for FEED_TTL_MS and revalidated with ETag.
 * Fallback order: fresh network data -> last cached feed -> house promos.
 */
import { MONETIZATION, SPONSOR_FEED_URL } from '@/config/monetization';
import { parseSponsorFeed, type SponsorFeed } from './feed';

export const FEED_CACHE_KEY = 'sponsorFeed';
export const FEED_TTL_MS = 6 * 60 * 60 * 1000;
export const FEED_TIMEOUT_MS = 5000;
export const MAX_FEED_BYTES = 64 * 1024;

export interface FeedCacheEntry {
  feed: SponsorFeed;
  etag: string | null;
  /** When the feed was last confirmed by the server (ms). */
  fetchedAt: number;
}

export interface FeedStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface FeedLoaderDeps {
  url: string;
  imageHosts: readonly string[];
  fetch: typeof fetch;
  storage: FeedStorage;
  now: () => number;
  timeoutMs: number;
  ttlMs: number;
}

export type FeedLoadResult =
  | {
      source: 'network' | 'cache';
      feed: SponsorFeed;
      /** When this feed was last confirmed by the server (ms). */
      fetchedAt: number;
    }
  | { source: 'house'; feed: null };

const chromeLocalStorage: FeedStorage = {
  async get(key) {
    const stored = await chrome.storage.local.get(key);
    return stored[key];
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
};

export function defaultFeedLoaderDeps(): FeedLoaderDeps {
  return {
    url: SPONSOR_FEED_URL,
    imageHosts: MONETIZATION.sponsorImageHosts,
    fetch: (input, init) => fetch(input, init),
    storage: chromeLocalStorage,
    now: Date.now,
    timeoutMs: FEED_TIMEOUT_MS,
    ttlMs: FEED_TTL_MS,
  };
}

/**
 * The cached feed, re-validated (storage is not trusted either), or null when
 * absent, unreadable or invalid.
 */
export async function readFeedCache(
  deps: Pick<FeedLoaderDeps, 'storage' | 'imageHosts'>
): Promise<FeedCacheEntry | null> {
  let raw: unknown;
  try {
    raw = await deps.storage.get(FEED_CACHE_KEY);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Partial<Record<keyof FeedCacheEntry, unknown>>;
  if (typeof entry.fetchedAt !== 'number' || !Number.isFinite(entry.fetchedAt))
    return null;
  try {
    const { feed } = parseSponsorFeed(entry.feed, {
      imageHosts: deps.imageHosts,
    });
    return {
      feed,
      etag: typeof entry.etag === 'string' ? entry.etag : null,
      fetchedAt: entry.fetchedAt,
    };
  } catch {
    return null;
  }
}

async function writeFeedCache(
  storage: FeedStorage,
  entry: FeedCacheEntry
): Promise<void> {
  try {
    await storage.set(FEED_CACHE_KEY, entry);
  } catch (error) {
    // The feed still shows for this session; the next open fetches again.
    console.warn('[sponsor] could not cache the sponsor feed', error);
  }
}

function isFresh(entry: FeedCacheEntry, deps: FeedLoaderDeps): boolean {
  const age = deps.now() - entry.fetchedAt;
  return age >= 0 && age < deps.ttlMs;
}

/**
 * The body as UTF-8 text, never holding more than MAX_FEED_BYTES: an
 * oversized Content-Length fails at once, and otherwise (e.g. a chunked
 * response without a length) the stream is read chunk by chunk and cancelled,
 * with the request aborted, as soon as it goes over the limit.
 */
async function readLimitedText(
  response: Response,
  abort: () => void
): Promise<string> {
  const declared = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_FEED_BYTES)
    throw new Error('sponsor feed is too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FEED_BYTES) {
      void reader.cancel().catch(() => {});
      abort();
      throw new Error('sponsor feed is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Downloads the feed, sending the cached ETag as If-None-Match. A 304 answers
 * with the cached copy. Throws on any failure.
 */
async function download(
  deps: FeedLoaderDeps,
  cached: FeedCacheEntry | null
): Promise<Omit<FeedCacheEntry, 'fetchedAt'>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const response = await deps.fetch(deps.url, {
      method: 'GET',
      credentials: 'omit',
      // Bypass the HTTP cache: freshness is decided here, and a manual
      // If-None-Match must surface the 304 instead of a cached 200.
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: cached?.etag ? { 'If-None-Match': cached.etag } : undefined,
      signal: controller.signal,
    });
    // A 304 is only meaningful as the answer to our If-None-Match.
    if (response.status === 304 && cached?.etag) {
      return { feed: cached.feed, etag: cached.etag };
    }
    if (!response.ok)
      throw new Error(`sponsor feed request failed (${response.status})`);
    const text = await readLimitedText(response, () => controller.abort());
    const { feed, issues } = parseSponsorFeed(JSON.parse(text), {
      imageHosts: deps.imageHosts,
    });
    if (issues.length > 0) console.warn('[sponsor] skipped creatives', issues);
    return { feed, etag: response.headers.get('ETag') };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the sponsor feed to display. A fresh cache answers without network;
 * otherwise the feed is downloaded (conditionally when an ETag is cached).
 * Never rejects: failures fall back to the cached feed, then to house promos.
 *
 * `cached` is the result of a readFeedCache call the caller already made
 * (null for "no usable cache"); when omitted the cache is read here.
 */
export async function loadSponsorFeed(
  deps: FeedLoaderDeps = defaultFeedLoaderDeps(),
  cached?: FeedCacheEntry | null
): Promise<FeedLoadResult> {
  const entry = cached === undefined ? await readFeedCache(deps) : cached;
  if (entry && isFresh(entry, deps))
    return { source: 'cache', feed: entry.feed, fetchedAt: entry.fetchedAt };

  try {
    const fresh = await download(deps, entry);
    const fetchedAt = deps.now();
    await writeFeedCache(deps.storage, { ...fresh, fetchedAt });
    return { source: 'network', feed: fresh.feed, fetchedAt };
  } catch (error) {
    console.warn('[sponsor] using fallback sponsor data', error);
  }
  return entry
    ? { source: 'cache', feed: entry.feed, fetchedAt: entry.fetchedAt }
    : { source: 'house', feed: null };
}
