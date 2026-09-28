import { describe, expect, it } from 'vitest';
import { cacheKey, createMemoryCacheStore, type CachedAnalysis } from './cache';

function entry(name: string): CachedAnalysis {
  return {
    storedAt: 1,
    result: {
      booth: { boothNumber: null, circleName: null, eventName: null, zone: null, isMailOrder: false },
      currency: null,
      items: [{ name, originalName: null, price: 1, category: 'other', options: [] }],
      meta: { provider: 'openai', model: 'm', latencyMs: 1, cached: false },
    },
  };
}

describe('cacheKey', () => {
  it('is a stable SHA-256 hex digest', async () => {
    const key = await cacheKey('openai', 'm', 1, 't', ['a', 'b']);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await cacheKey('openai', 'm', 1, 't', ['a', 'b'])).toBe(key);
  });

  it('changes with every component, including image order', async () => {
    const base = await cacheKey('openai', 'm', 1, 't', ['a', 'b']);
    const variants = await Promise.all([
      cacheKey('openrouter', 'm', 1, 't', ['a', 'b']),
      cacheKey('openai', 'm2', 1, 't', ['a', 'b']),
      cacheKey('openai', 'm', 2, 't', ['a', 'b']),
      cacheKey('openai', 'm', 1, 't2', ['a', 'b']),
      cacheKey('openai', 'm', 1, 't', ['b', 'a']),
      cacheKey('openai', 'm', 1, 't', ['ab']),
    ]);
    expect(new Set([base, ...variants]).size).toBe(7);
  });
});

describe('createMemoryCacheStore', () => {
  it('stores and returns clones', async () => {
    const store = createMemoryCacheStore(2);
    const value = entry('a');
    await store.set('k', value);
    value.result.items.length = 0;
    const read = await store.get('k');
    expect(read?.result.items).toHaveLength(1);
    read?.result.items.pop();
    expect((await store.get('k'))?.result.items).toHaveLength(1);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry', async () => {
    const store = createMemoryCacheStore(2);
    await store.set('a', entry('a'));
    await store.set('b', entry('b'));
    await store.get('a');
    await store.set('c', entry('c'));
    expect(await store.get('b')).toBeUndefined();
    expect(await store.get('a')).toBeDefined();
    expect(await store.get('c')).toBeDefined();
  });

  it('rejects invalid limits', () => {
    expect(() => createMemoryCacheStore(0)).toThrow(RangeError);
    expect(() => createMemoryCacheStore(1.5)).toThrow(RangeError);
  });
});
