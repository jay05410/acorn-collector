/**
 * Page-wide sponsor state for the side panel: one feed shared by every slot
 * and one selector so slots can avoid showing the same creative. Shaped for
 * React's useSyncExternalStore.
 *
 * A side panel can stay open for days, so while any slot is subscribed the
 * store rechecks when the page becomes visible, when it gains focus and every
 * RECHECK_INTERVAL_MS while visible. Each recheck publishes a new snapshot,
 * so slots re-evaluate date windows, and revalidates the feed once its TTL has
 * passed.
 */
import { FEATURES } from '@/config/monetization';
import type { SponsorFeed } from './feed';
import {
  defaultFeedLoaderDeps,
  loadSponsorFeed,
  readFeedCache,
  type FeedCacheEntry,
  type FeedLoadResult,
  type FeedLoaderDeps,
} from './loader';
import { SponsorSelector } from './select';

/** How often a visible page rechecks date windows and feed freshness. */
export const RECHECK_INTERVAL_MS = 30 * 60 * 1000;
/** After the feed could not be refreshed, wait this long before retrying. */
export const RETRY_AFTER_MS = 30 * 60 * 1000;

/**
 * `feed: null` means house promos only (no feed reachable or cached).
 * `checkedAt` changes on every recheck so slots re-evaluate date windows.
 */
export type SponsorFeedState =
  | { status: 'loading' }
  | { status: 'ready'; feed: SponsorFeed | null; checkedAt: number };

const LOADING: SponsorFeedState = { status: 'loading' };

let state: SponsorFeedState = LOADING;
let started = false;
let deps: FeedLoaderDeps | undefined;
/** The pending first load or revalidation, if any. */
let loading: Promise<void> | null = null;
/** When the feed should next be revalidated (ms since epoch). */
let revalidateAt = Number.POSITIVE_INFINITY;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

export const sponsorSelector = new SponsorSelector();

function setState(next: SponsorFeedState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

function ready(feed: SponsorFeed | null): SponsorFeedState {
  return { status: 'ready', feed, checkedAt: Date.now() };
}

function sameFeed(a: SponsorFeed | null, b: SponsorFeed): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Shows a load result unless it is the feed already on screen, and schedules
 * the next revalidation: when a fresh feed's TTL ends, otherwise (network
 * failed, stale fallback) after RETRY_AFTER_MS.
 */
function apply(result: FeedLoadResult, ttlMs: number): void {
  const now = Date.now();
  if (result.source === 'house') {
    revalidateAt = now + RETRY_AFTER_MS;
    // A feed already on screen stays rather than being dropped.
    if (state.status === 'loading') setState(ready(null));
    return;
  }
  const age = now - result.fetchedAt;
  revalidateAt =
    age >= 0 && age < ttlMs ? result.fetchedAt + ttlMs : now + RETRY_AFTER_MS;
  if (state.status === 'ready' && sameFeed(state.feed, result.feed)) return;
  setState(ready(result.feed));
}

/** `cached`: an entry already read by the caller, passed on to the loader. */
async function refresh(cached?: FeedCacheEntry | null): Promise<void> {
  deps ??= defaultFeedLoaderDeps();
  apply(await loadSponsorFeed(deps, cached), deps.ttlMs);
}

/**
 * First load, stale-while-revalidate: a cached feed (of any age) renders
 * immediately, then the loader refreshes it when stale. Slots keep their
 * current creative across the swap while it stays eligible.
 */
async function start(): Promise<void> {
  if (!FEATURES.remoteSponsorFeed) {
    setState(ready(null));
    return;
  }
  deps ??= defaultFeedLoaderDeps();
  const cached = await readFeedCache(deps);
  if (cached) setState(ready(cached.feed));
  await refresh(cached);
}

function run(task: () => Promise<void>): void {
  loading = task()
    .catch((error: unknown) => {
      console.warn('[sponsor] sponsor feed unavailable', error);
      revalidateAt = Date.now() + RETRY_AFTER_MS;
      if (state.status === 'loading') setState(ready(null));
    })
    .finally(() => {
      loading = null;
    });
}

function revalidateIfDue(): void {
  if (loading || !FEATURES.remoteSponsorFeed) return;
  if (Date.now() >= revalidateAt) run(() => refresh());
}

/** Publishes a new snapshot (date windows) and revalidates when due. */
function recheck(): void {
  if (state.status !== 'ready') return;
  setState({ ...state, checkedAt: Date.now() });
  revalidateIfDue();
}

function startTimer(): void {
  timer ??= setInterval(recheck, RECHECK_INTERVAL_MS);
}

function stopTimer(): void {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    startTimer();
    recheck();
  } else {
    stopTimer();
  }
}

function watch(): void {
  if (typeof document === 'undefined' || !FEATURES.remoteSponsorFeed) return;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', recheck);
  if (document.visibilityState === 'visible') startTimer();
}

function unwatch(): void {
  if (typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('focus', recheck);
  stopTimer();
}

export function subscribeSponsorFeed(listener: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    if (!started) {
      started = true;
      run(start);
    } else {
      // Slots are back after a while without any: catch up.
      revalidateIfDue();
    }
    watch();
  }
  return () => {
    if (listeners.delete(listener) && listeners.size === 0) unwatch();
  };
}

export function getSponsorFeedState(): SponsorFeedState {
  return state;
}
