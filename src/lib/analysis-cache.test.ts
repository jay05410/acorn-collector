import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppDatabase, type AppDatabase } from './db';
import {
  ANALYSIS_CACHE_MAX_AGE_MS,
  createAnalysisCache,
  type AnalysisCache,
} from './analysis-cache';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 29);

let counter = 0;
let database: AppDatabase;
let cache: AnalysisCache;

beforeEach(async () => {
  counter += 1;
  database = createAppDatabase(`acorn-cache-test-${counter}`);
  await database.open();
  cache = createAnalysisCache(database);
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(async () => {
  database.close();
  await Dexie.delete(database.name);
});

async function seed(count: number, createdAt: (i: number) => number) {
  await database.analysisCache.bulkPut(
    Array.from({ length: count }, (_, i) => ({
      key: `k${i}`,
      value: i,
      createdAt: createdAt(i),
    }))
  );
}

describe('analysis cache', () => {
  it('returns undefined on a miss', async () => {
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('stores and returns structured values', async () => {
    const value = { items: [{ name: 'Sticker', price: 500 }], currency: 'JPY' };
    await cache.set('hash:model:v1', value);

    expect(await cache.get('hash:model:v1')).toEqual(value);
    expect(await database.analysisCache.get('hash:model:v1')).toMatchObject({
      createdAt: NOW,
    });
  });

  it('overwrites an existing key and refreshes its timestamp', async () => {
    await cache.set('k', 1);
    vi.spyOn(Date, 'now').mockReturnValue(NOW + 1000);
    await cache.set('k', 2);

    expect(await cache.get('k')).toBe(2);
    expect((await database.analysisCache.get('k'))?.createdAt).toBe(NOW + 1000);
    expect(await database.analysisCache.count()).toBe(1);
  });

  it('prunes entries older than maxAgeMs', async () => {
    await seed(4, (i) => NOW - i * 10 * DAY);

    const removed = await cache.prune({ maxAgeMs: 15 * DAY });

    expect(removed).toBe(2);
    expect(
      (await database.analysisCache.toCollection().primaryKeys()).sort()
    ).toEqual(['k0', 'k1']);
  });

  it('keeps only the newest maxEntries', async () => {
    await seed(5, (i) => NOW - i);

    const removed = await cache.prune({ maxEntries: 2 });

    expect(removed).toBe(3);
    expect(
      (await database.analysisCache.toCollection().primaryKeys()).sort()
    ).toEqual(['k0', 'k1']);
  });

  it('defaults to 200 entries and 30 days', async () => {
    await seed(203, (i) => NOW - i);
    await database.analysisCache.put({
      key: 'expired',
      value: null,
      createdAt: NOW - ANALYSIS_CACHE_MAX_AGE_MS - 1,
    });

    const removed = await cache.prune();

    expect(removed).toBe(4);
    expect(await database.analysisCache.count()).toBe(200);
    expect(await cache.get('expired')).toBeUndefined();
    expect(await cache.get('k202')).toBeUndefined();
    expect(await cache.get('k199')).toBe(199);
  });

  it('is a no-op when within limits', async () => {
    await seed(3, () => NOW);
    expect(await cache.prune()).toBe(0);
    expect(await database.analysisCache.count()).toBe(3);
  });
});
