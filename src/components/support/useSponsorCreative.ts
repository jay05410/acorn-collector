import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLanguage } from '@/i18n';
import type { Placement } from '@/lib/sponsor/feed';
import { houseCreatives, type DisplayCreative } from '@/lib/sponsor/house';
import { eligibleCreatives } from '@/lib/sponsor/select';
import {
  getSponsorFeedState,
  sponsorSelector,
  subscribeSponsorFeed,
} from '@/lib/sponsor/store';

/**
 * The creative for one slot. `undefined` while the feed loads, `null` when
 * nothing is eligible.
 *
 * A slot may rotate (subject to the selector's minimum display time) when it
 * mounts and when the panel becomes visible again. When the feed, language or
 * the store's periodic recheck changes, it only rechecks: the current
 * creative stays while it is eligible, except that a sponsor replaces a house
 * promo as soon as one is free. Never rotates on a timer, so the slot does
 * not change while being read.
 */
export function useSponsorCreative(
  placement: Placement
): DisplayCreative | null | undefined {
  const language = useLanguage();
  const feedState = useSyncExternalStore(
    subscribeSponsorFeed,
    getSponsorFeedState
  );
  const [creative, setCreative] = useState<DisplayCreative | null>();
  const firstPick = useRef(true);

  // Free the creative only when the slot really unmounts. Releasing in the
  // re-pick effect below would free every slot at once on a shared update
  // (React runs all cleanups before any effect), letting slots take each
  // other's creatives.
  useEffect(() => () => sponsorSelector.release(placement), [placement]);

  useEffect(() => {
    if (feedState.status !== 'ready') return;
    const choose = (rotate: boolean) => {
      const now = Date.now();
      const context = { placement, language, now };
      const pools: DisplayCreative[][] = [
        eligibleCreatives(feedState.feed?.creatives ?? [], context),
        eligibleCreatives(houseCreatives(), context),
      ];
      setCreative(sponsorSelector.pick(placement, pools, now, { rotate }));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') choose(true);
    };
    choose(firstPick.current);
    firstPick.current = false;
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [feedState, language, placement]);

  return creative;
}
