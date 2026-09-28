/**
 * Page-wide sponsor state for the side panel: one feed load per page (shared
 * by every slot) and one selector so slots can avoid showing the same
 * creative. Shaped for React's useSyncExternalStore.
 */
import { FEATURES } from '@/config/monetization';
import type { SponsorFeed } from './feed';
import {
  defaultFeedLoaderDeps,
  loadSponsorFeed,
  readFeedCache,
} from './loader';
import { SponsorSelector } from './select';

/** `feed: null` means house promos only (no feed reachable or cached). */
export type SponsorFeedState =
  | { status: 'loading' }
  | { status: 'ready'; feed: SponsorFeed | null };

const LOADING: SponsorFeedState = { status: 'loading' };

let state: SponsorFeedState = LOADING;
let started = false;
const listeners = new Set<() => void>();

export const sponsorSelector = new SponsorSelector();

function setState(next: SponsorFeedState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

/**
 * Stale-while-revalidate: a cached feed (of any age) renders immediately,
 * then the loader refreshes it when stale. Slots keep their current creative
 * across the swap (see SponsorSelector).
 */
async function start(): Promise<void> {
  if (!FEATURES.remoteSponsorFeed) {
    setState({ status: 'ready', feed: null });
    return;
  }
  const deps = defaultFeedLoaderDeps();
  const cached = await readFeedCache(deps);
  if (cached) setState({ status: 'ready', feed: cached.feed });
  const result = await loadSponsorFeed(deps);
  // Falling back to the feed already on screen needs no update.
  if (!(cached && result.source === 'cache'))
    setState({ status: 'ready', feed: result.feed });
}

export function subscribeSponsorFeed(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    start().catch((error: unknown) => {
      console.warn('[sponsor] sponsor feed unavailable', error);
      setState({ status: 'ready', feed: null });
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getSponsorFeedState(): SponsorFeedState {
  return state;
}
