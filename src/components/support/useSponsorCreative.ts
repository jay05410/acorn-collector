import { useEffect, useState, useSyncExternalStore } from 'react';
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
 * nothing is eligible. Re-picks (subject to the selector's minimum display
 * time) when the feed or language changes and when the panel becomes visible
 * again; never on a timer, so the slot does not rotate while being read.
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

  useEffect(() => {
    if (feedState.status !== 'ready') return;
    const choose = () => {
      const now = Date.now();
      const context = { placement, language, now };
      const pools: DisplayCreative[][] = [
        eligibleCreatives(feedState.feed?.creatives ?? [], context),
        eligibleCreatives(houseCreatives(), context),
      ];
      setCreative(sponsorSelector.pick(placement, pools, now));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') choose();
    };
    choose();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sponsorSelector.release(placement);
    };
  }, [feedState, language, placement]);

  return creative;
}
