/**
 * Creative selection: contextual filtering (placement, UI language, date
 * window), weighted random choice, a minimum display time per placement and
 * no creative in two slots at once.
 */
import type { AppLanguage } from '@/i18n/languages';
import { parseIsoDateTime, type Creative, type Placement } from './feed';

/** A placement keeps its creative at least this long. */
export const STABLE_MS = 60_000;

/** Returns a number in [0, 1), like Math.random. */
export type Rng = () => number;

export interface SelectionContext {
  placement: Placement;
  language: AppLanguage;
  now: number;
}

/** Whether a creative may run in this slot, language and moment. */
export function isEligible(
  creative: Creative,
  context: SelectionContext
): boolean {
  if (!creative.placements.includes(context.placement)) return false;
  if (
    !creative.locales.includes('*') &&
    !creative.locales.includes(context.language)
  ) {
    return false;
  }
  const startsAt = creative.startsAt
    ? parseIsoDateTime(creative.startsAt)
    : null;
  const endsAt = creative.endsAt ? parseIsoDateTime(creative.endsAt) : null;
  if (startsAt !== null && context.now < startsAt) return false;
  if (endsAt !== null && context.now >= endsAt) return false;
  return true;
}

export function eligibleCreatives<T extends Creative>(
  creatives: readonly T[],
  context: SelectionContext
): T[] {
  return creatives.filter((creative) => isEligible(creative, context));
}

/** Picks one item with probability proportional to its weight (default 1). */
export function weightedPick<T extends Pick<Creative, 'weight'>>(
  items: readonly T[],
  rng: Rng
): T | null {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  if (items.length === 0 || total <= 0) return null;
  let target = rng() * total;
  for (const item of items) {
    target -= item.weight ?? 1;
    if (target < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

interface Hold {
  id: string;
  since: number;
}

export interface PickOptions {
  /**
   * true (default): a pick older than `stableMs` may be replaced, e.g. when
   * the slot mounts or the panel becomes visible again. false: keep the
   * current creative while it is still eligible (feed, language or clock
   * recheck), so shared updates do not reshuffle the slots.
   */
  rotate?: boolean;
}

/**
 * Remembers which creative each placement shows. Picks are kept for
 * `stableMs` (also across a quick unmount/remount of the slot) and a creative
 * shown by one active placement is never picked for another.
 */
export class SponsorSelector {
  private readonly holds = new Map<Placement, Hold>();
  private readonly active = new Set<Placement>();
  private readonly rng: Rng;
  private readonly stableMs: number;

  constructor(options: { rng?: Rng; stableMs?: number } = {}) {
    this.rng = options.rng ?? Math.random;
    this.stableMs = options.stableMs ?? STABLE_MS;
  }

  /**
   * Chooses the creative for a placement. `pools` are eligible creatives in
   * priority order (sponsor feed first, then house promos); a lower pool is
   * used only when every higher one is empty or already shown elsewhere.
   *
   * The current creative is kept (see PickOptions.rotate) unless it is no
   * longer eligible, another active slot shows it, or a higher pool now has
   * a creative free: a slot showing a house promo switches to a sponsor as
   * soon as one is available. The hold only prevents churn within a pool.
   */
  pick<T extends Creative>(
    placement: Placement,
    pools: readonly (readonly T[])[],
    now: number,
    options: PickOptions = {}
  ): T | null {
    this.active.add(placement);
    const taken = new Set<string>();
    for (const other of this.active) {
      const hold = this.holds.get(other);
      if (other !== placement && hold) taken.add(hold.id);
    }
    // The highest-priority pool with a creative no other slot shows.
    const best = pools
      .map((pool) => pool.filter((creative) => !taken.has(creative.id)))
      .find((pool) => pool.length > 0);
    if (!best) {
      this.holds.delete(placement);
      return null;
    }

    const previous = this.holds.get(placement);
    const rotate = options.rotate ?? true;
    if (previous && (!rotate || now - previous.since < this.stableMs)) {
      const kept = best.find((creative) => creative.id === previous.id);
      if (kept) return kept;
    }

    const choice = weightedPick(best, this.rng);
    if (choice) this.holds.set(placement, { id: choice.id, since: now });
    else this.holds.delete(placement);
    return choice;
  }

  /** The slot unmounted; its creative may now appear elsewhere. */
  release(placement: Placement): void {
    this.active.delete(placement);
  }
}
