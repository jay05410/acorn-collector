import { describe, expect, it } from 'vitest';
import type { Creative } from './feed';
import {
  STABLE_MS,
  SponsorSelector,
  eligibleCreatives,
  isEligible,
  weightedPick,
  type Rng,
} from './select';

const NOW = Date.UTC(2026, 9, 15, 12);

function creative(id: string, overrides: Partial<Creative> = {}): Creative {
  return {
    id,
    placements: ['footer', 'analysis', 'settings'],
    locales: ['*'],
    title: id,
    clickUrl: `https://acme.example/${id}`,
    sponsorName: 'Acme',
    ...overrides,
  };
}

/** Deterministic mulberry32 RNG. */
function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the given values in turn. */
function sequence(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

const footerKo = { placement: 'footer', language: 'ko', now: NOW } as const;

describe('isEligible', () => {
  it("matches '*' and exact language codes only", () => {
    expect(isEligible(creative('a'), footerKo)).toBe(true);
    expect(isEligible(creative('a', { locales: ['ko', 'ja'] }), footerKo)).toBe(
      true
    );
    expect(isEligible(creative('a', { locales: ['ja'] }), footerKo)).toBe(
      false
    );
    expect(
      isEligible(creative('a', { locales: ['zh-CN'] }), {
        ...footerKo,
        language: 'zh-TW',
      })
    ).toBe(false);
  });

  it('filters by placement', () => {
    const settingsOnly = creative('a', { placements: ['settings'] });
    expect(isEligible(settingsOnly, footerKo)).toBe(false);
    expect(
      isEligible(settingsOnly, { ...footerKo, placement: 'settings' })
    ).toBe(true);
  });

  it('respects the date window: start inclusive, end exclusive', () => {
    const windowed = creative('a', {
      startsAt: new Date(NOW).toISOString(),
      endsAt: new Date(NOW + 1000).toISOString(),
    });
    expect(isEligible(windowed, { ...footerKo, now: NOW - 1 })).toBe(false);
    expect(isEligible(windowed, footerKo)).toBe(true);
    expect(isEligible(windowed, { ...footerKo, now: NOW + 999 })).toBe(true);
    expect(isEligible(windowed, { ...footerKo, now: NOW + 1000 })).toBe(false);
  });

  it('honors time zone offsets', () => {
    // 2026-10-15T21:00+09:00 is 12:00 UTC, which is NOW.
    const startsLater = creative('a', {
      startsAt: '2026-10-15T21:00:01+09:00',
    });
    expect(isEligible(startsLater, footerKo)).toBe(false);
  });

  it('eligibleCreatives keeps order', () => {
    const list = [
      creative('a'),
      creative('b', { locales: ['en'] }),
      creative('c'),
    ];
    expect(eligibleCreatives(list, footerKo).map((c) => c.id)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('weightedPick', () => {
  it('returns null for an empty list', () => {
    expect(weightedPick([], Math.random)).toBeNull();
  });

  it('maps the RNG onto cumulative weights', () => {
    const items = [creative('a', { weight: 1 }), creative('b', { weight: 3 })];
    expect(weightedPick(items, () => 0)?.id).toBe('a');
    expect(weightedPick(items, () => 0.24)?.id).toBe('a');
    expect(weightedPick(items, () => 0.25)?.id).toBe('b');
    expect(weightedPick(items, () => 0.999)?.id).toBe('b');
  });

  it('follows the weights over many seeded draws', () => {
    const items = [
      creative('light', { weight: 1 }),
      creative('default'),
      creative('heavy', { weight: 8 }),
    ];
    const rng = seeded(42);
    const counts: Record<string, number> = { light: 0, default: 0, heavy: 0 };
    const draws = 20_000;
    for (let i = 0; i < draws; i++) {
      const id = weightedPick(items, rng)?.id ?? '';
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect((counts.light ?? 0) / draws).toBeCloseTo(0.1, 1);
    expect((counts.default ?? 0) / draws).toBeCloseTo(0.1, 1);
    expect((counts.heavy ?? 0) / draws).toBeCloseTo(0.8, 1);
  });
});

describe('SponsorSelector', () => {
  const pool = [creative('a'), creative('b'), creative('c')];

  it('keeps a pick for at least STABLE_MS', () => {
    const selector = new SponsorSelector({ rng: sequence(0, 0.9) });
    const first = selector.pick('footer', [pool], NOW);
    expect(first?.id).toBe('a');
    expect(selector.pick('footer', [pool], NOW + 1)?.id).toBe('a');
    expect(selector.pick('footer', [pool], NOW + STABLE_MS - 1)?.id).toBe('a');
    expect(selector.pick('footer', [pool], NOW + STABLE_MS)?.id).toBe('c');
  });

  it('keeps the pick across a quick remount', () => {
    const selector = new SponsorSelector({ rng: sequence(0, 0.9) });
    selector.pick('footer', [pool], NOW);
    selector.release('footer');
    expect(selector.pick('footer', [pool], NOW + 5000)?.id).toBe('a');
  });

  it('re-picks early when the held creative is no longer eligible', () => {
    const selector = new SponsorSelector({ rng: sequence(0) });
    selector.pick('footer', [pool], NOW);
    expect(selector.pick('footer', [pool.slice(1)], NOW + 1)?.id).toBe('b');
  });

  it('never shows one creative in two active slots', () => {
    const selector = new SponsorSelector({ rng: () => 0 });
    const footer = selector.pick('footer', [pool], NOW);
    const settings = selector.pick('settings', [pool], NOW);
    const analysis = selector.pick('analysis', [pool], NOW);
    expect(new Set([footer?.id, settings?.id, analysis?.id]).size).toBe(3);
  });

  it('frees a creative when its slot unmounts', () => {
    const selector = new SponsorSelector({ rng: () => 0 });
    const single = [creative('only')];
    expect(selector.pick('footer', [single], NOW)?.id).toBe('only');
    expect(selector.pick('settings', [single], NOW)).toBeNull();
    selector.release('footer');
    expect(selector.pick('settings', [single], NOW)?.id).toBe('only');
  });

  it('does not keep a held creative that another slot took meanwhile', () => {
    const selector = new SponsorSelector({ rng: () => 0 });
    const two = [creative('a'), creative('b')];
    selector.pick('footer', [two], NOW); // a
    selector.release('footer');
    selector.pick('settings', [two], NOW + 1); // a is free again
    expect(selector.pick('footer', [two], NOW + 2)?.id).toBe('b');
  });

  it('falls back to the next pool when the first is used up', () => {
    const selector = new SponsorSelector({ rng: () => 0 });
    const sponsors = [creative('sponsor')];
    const house = [creative('house-a'), creative('house-b')];
    expect(selector.pick('footer', [sponsors, house], NOW)?.id).toBe('sponsor');
    expect(selector.pick('settings', [sponsors, house], NOW)?.id).toBe(
      'house-a'
    );
    expect(selector.pick('analysis', [[], house], NOW)?.id).toBe('house-b');
  });

  it('keeps a house pick stable when sponsor data arrives later', () => {
    const selector = new SponsorSelector({ rng: () => 0 });
    const house = [creative('house-a')];
    selector.pick('footer', [[], house], NOW);
    expect(
      selector.pick('footer', [[creative('sponsor')], house], NOW + 1000)?.id
    ).toBe('house-a');
  });

  it('returns null when nothing is eligible', () => {
    expect(new SponsorSelector().pick('footer', [[], []], NOW)).toBeNull();
  });
});
