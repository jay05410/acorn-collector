// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SponsorFeed } from './feed';
import type { FeedCacheEntry, FeedLoadResult } from './loader';

const TTL_MS = 6 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 1);

const readFeedCache =
  vi.fn<(deps: unknown) => Promise<FeedCacheEntry | null>>();
const loadSponsorFeed =
  vi.fn<
    (deps: unknown, cached?: FeedCacheEntry | null) => Promise<FeedLoadResult>
  >();

vi.mock('./loader', () => ({
  defaultFeedLoaderDeps: () => ({ ttlMs: TTL_MS }),
  readFeedCache: (deps: unknown) => readFeedCache(deps),
  loadSponsorFeed: (deps: unknown, cached?: FeedCacheEntry | null) =>
    loadSponsorFeed(deps, cached),
}));

function feed(updatedAt: string): SponsorFeed {
  return { version: 1, updatedAt, creatives: [] };
}

function ready(value: SponsorFeed | null) {
  return { status: 'ready', feed: value, checkedAt: expect.any(Number) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Lets pending promise chains settle (setTimeout stays real). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setVisibility(visibility: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function focus(): void {
  window.dispatchEvent(new Event('focus'));
}

const unsubscribers: (() => void)[] = [];

/** A fresh copy of the module-level store for each test. */
async function freshStore() {
  vi.resetModules();
  const store = await import('./store');
  return {
    ...store,
    subscribe(listener: () => void = () => {}) {
      const unsubscribe = store.subscribeSponsorFeed(listener);
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
  };
}

/** Fake Date and intervals only, so flush() keeps working. */
function fakeClock(): void {
  vi.useFakeTimers({
    now: T0,
    toFake: ['Date', 'setInterval', 'clearInterval'],
  });
}

/** The loader answers with a feed confirmed by the server just now. */
function networkNow(updatedAt = '2026-09-29T00:00:00Z'): void {
  loadSponsorFeed.mockImplementation(async () => ({
    source: 'network',
    feed: feed(updatedAt),
    fetchedAt: Date.now(),
  }));
}

beforeEach(() => {
  readFeedCache.mockReset();
  loadSponsorFeed.mockReset();
  setVisibility('visible');
});

afterEach(() => {
  // Detach every store's page listeners so tests do not see each other.
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('sponsor feed store', () => {
  it('starts loading on the first subscriber only', async () => {
    readFeedCache.mockResolvedValue(null);
    loadSponsorFeed.mockResolvedValue({ source: 'house', feed: null });
    const store = await freshStore();
    expect(store.getSponsorFeedState()).toEqual({ status: 'loading' });

    const listener = vi.fn();
    store.subscribe(listener);
    store.subscribe();
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual(ready(null))
    );
    expect(loadSponsorFeed).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('passes the cache it already read to the loader', async () => {
    const cached = {
      feed: feed('2026-09-01T00:00:00Z'),
      etag: '"v1"',
      fetchedAt: 0,
    };
    readFeedCache.mockResolvedValue(cached);
    loadSponsorFeed.mockResolvedValue({
      source: 'cache',
      feed: cached.feed,
      fetchedAt: 0,
    });
    const store = await freshStore();
    store.subscribe();
    await vi.waitFor(() => expect(loadSponsorFeed).toHaveBeenCalled());
    expect(readFeedCache).toHaveBeenCalledOnce();
    expect(loadSponsorFeed).toHaveBeenCalledWith(expect.anything(), cached);
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
    store.subscribe();

    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual(
        ready(feed('2026-09-01T00:00:00Z'))
      )
    );
    network.resolve({
      source: 'network',
      feed: feed('2026-09-29T00:00:00Z'),
      fetchedAt: Date.now(),
    });
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual(
        ready(feed('2026-09-29T00:00:00Z'))
      )
    );
  });

  it('does not re-emit when the loader falls back to the cached feed', async () => {
    const cached = {
      feed: feed('2026-09-01T00:00:00Z'),
      etag: null,
      fetchedAt: 0,
    };
    readFeedCache.mockResolvedValue(cached);
    loadSponsorFeed.mockResolvedValue({
      source: 'cache',
      feed: cached.feed,
      fetchedAt: 0,
    });
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await vi.waitFor(() => expect(loadSponsorFeed).toHaveBeenCalled());
    // Let the loader's result settle before counting notifications.
    await flush();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('skips the network and page triggers when the remote feed is off', async () => {
    vi.stubEnv('VITE_REMOTE_SPONSOR_FEED', 'off');
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual(ready(null))
    );
    focus();
    expect(listener).toHaveBeenCalledOnce();
    expect(readFeedCache).not.toHaveBeenCalled();
    expect(loadSponsorFeed).not.toHaveBeenCalled();
  });

  it('falls back to house promos if loading throws unexpectedly', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    readFeedCache.mockRejectedValue(new Error('boom'));
    const store = await freshStore();
    store.subscribe();
    await vi.waitFor(() =>
      expect(store.getSponsorFeedState()).toEqual(ready(null))
    );
  });
});

describe('sponsor feed store rechecks', () => {
  it('revalidates on focus once the TTL has passed', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    networkNow('2026-09-29T00:00:00Z');
    const store = await freshStore();
    store.subscribe();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledOnce();

    vi.setSystemTime(T0 + TTL_MS - 1);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledOnce();

    networkNow('2026-10-01T06:00:00Z');
    vi.setSystemTime(T0 + TTL_MS);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);
    // Revalidation re-reads storage: another page may have refreshed it.
    expect(loadSponsorFeed).toHaveBeenLastCalledWith(
      expect.anything(),
      undefined
    );
    expect(store.getSponsorFeedState()).toEqual(
      ready(feed('2026-10-01T06:00:00Z'))
    );
  });

  it("counts the TTL from the cached feed's age", async () => {
    fakeClock();
    const fetchedAt = T0 - TTL_MS + 60_000; // stale in one minute
    const cached = {
      feed: feed('2026-09-01T00:00:00Z'),
      etag: null,
      fetchedAt,
    };
    readFeedCache.mockResolvedValue(cached);
    loadSponsorFeed.mockResolvedValue({
      source: 'cache',
      feed: cached.feed,
      fetchedAt,
    });
    const store = await freshStore();
    store.subscribe();
    await flush();

    vi.setSystemTime(T0 + 60_000);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);
  });

  it('rechecks on a timer while visible, never while hidden', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    networkNow();
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    listener.mockClear();
    expect(store.RECHECK_INTERVAL_MS).toBe(30 * 60 * 1000);

    // Each tick publishes a snapshot so slots recheck date windows...
    await vi.advanceTimersByTimeAsync(store.RECHECK_INTERVAL_MS);
    expect(listener).toHaveBeenCalledOnce();
    expect(loadSponsorFeed).toHaveBeenCalledOnce();
    // ...and the tick after the TTL ends revalidates the feed.
    await vi.advanceTimersByTimeAsync(TTL_MS - store.RECHECK_INTERVAL_MS);
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);

    setVisibility('hidden');
    listener.mockClear();
    await vi.advanceTimersByTimeAsync(TTL_MS * 2);
    expect(listener).not.toHaveBeenCalled();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);

    // Coming back rechecks at once.
    setVisibility('visible');
    await flush();
    expect(listener).toHaveBeenCalled();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(3);
  });

  it('publishes a new snapshot on focus even when the feed is unchanged', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    networkNow();
    const store = await freshStore();
    store.subscribe();
    await flush();
    const before = store.getSponsorFeedState();

    vi.setSystemTime(T0 + 1000);
    focus();
    const after = store.getSponsorFeedState();
    expect(after).not.toBe(before);
    expect(after).toEqual({ ...before, checkedAt: T0 + 1000 });
  });

  it('waits RETRY_AFTER_MS after a failed refresh instead of retrying on every focus', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    loadSponsorFeed.mockResolvedValue({ source: 'house', feed: null });
    const store = await freshStore();
    store.subscribe();
    await flush();

    vi.setSystemTime(T0 + store.RETRY_AFTER_MS - 1);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledOnce();

    vi.setSystemTime(T0 + store.RETRY_AFTER_MS);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);
  });

  it('keeps a feed on screen when a later refresh finds nothing', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    networkNow('2026-09-29T00:00:00Z');
    const store = await freshStore();
    store.subscribe();
    await flush();

    loadSponsorFeed.mockResolvedValue({ source: 'house', feed: null });
    vi.setSystemTime(T0 + TTL_MS);
    focus();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);
    expect(store.getSponsorFeedState()).toEqual(
      ready(feed('2026-09-29T00:00:00Z'))
    );
  });

  it('stops watching the page when the last slot unsubscribes', async () => {
    fakeClock();
    readFeedCache.mockResolvedValue(null);
    networkNow();
    const store = await freshStore();
    const unsubscribe = store.subscribe();
    await flush();
    unsubscribe();

    vi.setSystemTime(T0 + TTL_MS);
    focus();
    await vi.advanceTimersByTimeAsync(store.RECHECK_INTERVAL_MS);
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledOnce();

    // A slot mounting again catches up.
    store.subscribe();
    await flush();
    expect(loadSponsorFeed).toHaveBeenCalledTimes(2);
  });
});
