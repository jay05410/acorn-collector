/**
 * Background enrichment: replace what the DOM showed with better sources
 * where one exists. Never throws; on any failure the snapshot is returned
 * unchanged.
 */
import type { PageSnapshot } from '../types';
import { enrichBlueskySnapshot } from './bluesky';
import { enrichBoothSnapshot } from './booth';
import type { EnrichDeps } from './http';
import { enrichXSnapshot } from './x';

export type { EnrichDeps } from './http';

export async function enrichSnapshot(
  snapshot: PageSnapshot,
  deps: EnrichDeps
): Promise<PageSnapshot> {
  try {
    switch (snapshot.site) {
      case 'x':
        return await enrichXSnapshot(snapshot, deps);
      case 'bluesky':
        return await enrichBlueskySnapshot(snapshot, deps);
      case 'booth':
        return await enrichBoothSnapshot(snapshot, deps);
      default:
        return snapshot;
    }
  } catch {
    return snapshot;
  }
}
