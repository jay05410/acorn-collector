import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SponsorFeed } from './feed';
import type { FeedCacheEntry, FeedLoadResult } from './loader';

const readFeedCache = vi.fn<() => Promise<FeedCacheEntry | null>>();
const loadSponsorFeed = vi.fn<() => Promise<FeedLoadResult>>();

vi.mock('./loader', () => ({
  defaultFeedLoaderDeps: () => ({}),
  readFeedCache: () => readFeedCache(),
  loadSponsorFeed: () => loadSponsorFeed(),
}));

function feed(updatedAt: string): SponsorFeed {
  return { version: 1, updatedAt, creatives: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A fresh copy of the module-level store for each test. */
async function freshStore() {
  vi.resetModules();
  return import('./store');
}

beforeEach(() => {
  readFeedCache.mockReset();
  loadSponsorFeed.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sponsor feed store', () => {
  it('starts loading on the first subscriber only', async () => {
    readFeedCache.mockResolvedValue(null);
    loadSponsorFeed.mockResolvedValue({ source: 'house', feed: null });
    const store = await freshStore();
    expect(store.getSponsorFeedState()).toEqual({ status: 'loading' });

    const listener = vi.fn();
    store.subscribeSponsorFeed(listener);
    store.subscribeSponsorFeed(vi.fn());
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual({
        status: 'ready',
        feed: null,
      })
    );
    expect(loadSponsorFeed).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('shows a stale cached feed at once, then the refreshed one', async () => {
    const network = deferred<FeedLoadResult>();
    readFeedCache.mockResolvedValue({
      feed: feed('2026-09-01T00:00:00Z'),
      etag: null,
      fetchedAt: 0,
    });
    loadSponsorFeed.mockReturnValue(network.promise);
    const store = await freshStore();
    store.subscribeSponsorFeed(() => {});

    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual({
        status: 'ready',
        feed: feed('2026-09-01T00:00:00Z'),
      })
    );
    network.resolve({ source: 'network', feed: feed('2026-09-29T00:00:00Z') });
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual({
        status: 'ready',
        feed: feed('2026-09-29T00:00:00Z'),
      })
    );
  });

  it('does not re-emit when the loader falls back to the cached feed', async () => {
    const cached = {
      feed: feed('2026-09-01T00:00:00Z'),
      etag: null,
      fetchedAt: 0,
    };
    readFeedCache.mockResolvedValue(cached);
    loadSponsorFeed.mockResolvedValue({ source: 'cache', feed: cached.feed });
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeSponsorFeed(listener);
    await vi.waitFor(() => expect(loadSponsorFeed).toHaveBeenCalled());
    // Let the loader's result settle before counting notifications.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('skips the network when the remote feed is turned off', async () => {
    vi.stubEnv('VITE_REMOTE_SPONSOR_FEED', 'off');
    const store = await freshStore();
    store.subscribeSponsorFeed(() => {});
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual({
        status: 'ready',
        feed: null,
      })
    );
    expect(readFeedCache).not.toHaveBeenCalled();
    expect(loadSponsorFeed).not.toHaveBeenCalled();
  });

  it('falls back to house promos if loading throws unexpectedly', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    readFeedCache.mockRejectedValue(new Error('boom'));
    const store = await freshStore();
    store.subscribeSponsorFeed(() => {});
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual({
        status: 'ready',
        feed: null,
      })
    );
  });
});
