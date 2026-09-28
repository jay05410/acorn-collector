import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SponsorFeed } from './feed';
import {
  FEED_CACHE_KEY,
  FEED_TTL_MS,
  MAX_FEED_BYTES,
  loadSponsorFeed,
  readFeedCache,
  type FeedCacheEntry,
  type FeedLoaderDeps,
} from './loader';

const FEED_URL =
  'https://raw.githubusercontent.com/o/r/main/sponsors/feed.json';
const T0 = Date.UTC(2026, 9, 1);

function feed(title: string): SponsorFeed {
  return {
    version: 1,
    updatedAt: '2026-09-29T00:00:00Z',
    creatives: [
      {
        id: 'acme',
        placements: ['footer'],
        locales: ['*'],
        title,
        clickUrl: 'https://acme.example/',
        sponsorName: 'Acme',
      },
    ],
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });
}

function setup(initial?: FeedCacheEntry) {
  const data = new Map<string, unknown>();
  if (initial) data.set(FEED_CACHE_KEY, structuredClone(initial));
  let now = T0;
  const fetchMock = vi.fn<typeof fetch>();
  const deps: FeedLoaderDeps = {
    url: FEED_URL,
    imageHosts: ['raw.githubusercontent.com'],
    fetch: fetchMock,
    storage: {
      get: async (key) => structuredClone(data.get(key)),
      set: async (key, value) => {
        data.set(key, structuredClone(value));
      },
    },
    now: () => now,
    timeoutMs: 5000,
    ttlMs: FEED_TTL_MS,
  };
  return {
    deps,
    fetchMock,
    data,
    advance: (ms: number) => {
      now += ms;
    },
    cached: () => data.get(FEED_CACHE_KEY) as FeedCacheEntry | undefined,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadSponsorFeed', () => {
  it('downloads without cookies, referrer or query and caches the feed', async () => {
    const { deps, fetchMock, cached } = setup();
    fetchMock.mockResolvedValue(
      jsonResponse(feed('fresh'), { headers: { ETag: '"v1"' } })
    );

    const result = await loadSponsorFeed(deps);

    expect(result).toEqual({ source: 'network', feed: feed('fresh') });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(FEED_URL);
    expect(init).toMatchObject({
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: undefined,
    });
    expect(cached()).toEqual({
      feed: feed('fresh'),
      etag: '"v1"',
      fetchedAt: T0,
    });
  });

  it('serves a fresh cache without network until the TTL passes', async () => {
    const { deps, fetchMock, advance } = setup({
      feed: feed('cached'),
      etag: '"v1"',
      fetchedAt: T0,
    });

    advance(FEED_TTL_MS - 1);
    expect(await loadSponsorFeed(deps)).toEqual({
      source: 'cache',
      feed: feed('cached'),
    });
    expect(fetchMock).not.toHaveBeenCalled();

    advance(1);
    fetchMock.mockResolvedValue(jsonResponse(feed('next')));
    expect((await loadSponsorFeed(deps)).source).toBe('network');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('treats a cache timestamp from the future as stale', async () => {
    const { deps, fetchMock } = setup({
      feed: feed('cached'),
      etag: null,
      fetchedAt: T0 + 60_000,
    });
    fetchMock.mockResolvedValue(jsonResponse(feed('fresh')));
    expect((await loadSponsorFeed(deps)).feed?.creatives[0]?.title).toBe(
      'fresh'
    );
  });

  it('revalidates with If-None-Match and keeps the feed on 304', async () => {
    const { deps, fetchMock, advance, cached } = setup({
      feed: feed('cached'),
      etag: '"v1"',
      fetchedAt: T0,
    });
    advance(FEED_TTL_MS + 1);
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }));

    const result = await loadSponsorFeed(deps);

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      'If-None-Match': '"v1"',
    });
    expect(result).toEqual({ source: 'network', feed: feed('cached') });
    expect(cached()?.fetchedAt).toBe(T0 + FEED_TTL_MS + 1);
    expect(cached()?.etag).toBe('"v1"');

    // The refreshed timestamp restarts the TTL.
    advance(FEED_TTL_MS - 1);
    await loadSponsorFeed(deps);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to the stale cache when the network fails', async () => {
    const { deps, fetchMock, advance, cached } = setup({
      feed: feed('cached'),
      etag: null,
      fetchedAt: T0,
    });
    advance(FEED_TTL_MS * 10);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await loadSponsorFeed(deps)).toEqual({
      source: 'cache',
      feed: feed('cached'),
    });
    expect(cached()?.fetchedAt).toBe(T0);
  });

  it('falls back to house promos with no cache and no network', async () => {
    const { deps, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await loadSponsorFeed(deps)).toEqual({
      source: 'house',
      feed: null,
    });
  });

  it.each([
    ['an HTTP error', () => new Response('nope', { status: 404 })],
    ['invalid JSON', () => new Response('{not json', { status: 200 })],
    ['a bad envelope', () => jsonResponse({ version: 2, creatives: [] })],
    [
      'an oversized body',
      () => jsonResponse({ ...feed('x'), padding: 'x'.repeat(MAX_FEED_BYTES) }),
    ],
    [
      'an oversized Content-Length',
      () =>
        new Response('{}', {
          headers: { 'Content-Length': String(MAX_FEED_BYTES + 1) },
        }),
    ],
    ['a 304 without a cached feed', () => new Response(null, { status: 304 })],
  ])('keeps the fallback on %s', async (_label, respond) => {
    const withCache = setup({ feed: feed('cached'), etag: null, fetchedAt: 0 });
    withCache.fetchMock.mockResolvedValue(respond());
    expect(await loadSponsorFeed(withCache.deps)).toEqual({
      source: 'cache',
      feed: feed('cached'),
    });

    const empty = setup();
    empty.fetchMock.mockResolvedValue(respond());
    expect(await loadSponsorFeed(empty.deps)).toEqual({
      source: 'house',
      feed: null,
    });
    expect(empty.cached()).toBeUndefined();
  });

  it('aborts after the timeout', async () => {
    vi.useFakeTimers();
    const { deps, fetchMock } = setup();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const pending = loadSponsorFeed(deps);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ source: 'house', feed: null });
  });

  it('keeps valid creatives from a partly invalid feed', async () => {
    const { deps, fetchMock } = setup();
    const mixed = {
      ...feed('ok'),
      creatives: [
        ...feed('ok').creatives,
        {
          ...feed('bad').creatives[0],
          id: 'bad',
          clickUrl: 'http://x.example/',
        },
      ],
    };
    fetchMock.mockResolvedValue(jsonResponse(mixed));
    const result = await loadSponsorFeed(deps);
    expect(result.feed?.creatives.map((c) => c.id)).toEqual(['acme']);
  });

  it('still returns the downloaded feed when caching fails', async () => {
    const { deps, fetchMock } = setup();
    deps.storage.set = () => Promise.reject(new Error('QUOTA_BYTES'));
    fetchMock.mockResolvedValue(jsonResponse(feed('fresh')));
    expect((await loadSponsorFeed(deps)).source).toBe('network');
  });
});

describe('readFeedCache', () => {
  it.each([
    ['nothing', undefined],
    ['a non-object', 'feed'],
    ['a missing timestamp', { feed: feed('x'), etag: null }],
    ['an invalid feed', { feed: { version: 9 }, etag: null, fetchedAt: T0 }],
  ])('ignores %s', async (_label, stored) => {
    const { deps, data } = setup();
    data.set(FEED_CACHE_KEY, stored);
    expect(await readFeedCache(deps)).toBeNull();
  });

  it('ignores a storage error', async () => {
    const { deps } = setup();
    deps.storage.get = () => Promise.reject(new Error('unavailable'));
    expect(await readFeedCache(deps)).toBeNull();
  });
});
