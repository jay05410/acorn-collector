import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalysisCache } from '@/lib/analysis-cache';
import { createAppDatabase } from '@/lib/db';
import { DEFAULT_AI_SETTINGS, type AISettings } from '@/lib/settings-types';
import type { CachedAnalysis } from './cache';
import { getProvider } from './providers';
import {
  createDexieCacheStore,
  ensureAIRuntime,
  getRuntimeCliTarget,
  isAIConfigured,
  setRuntimeAISettings,
} from './runtime';

const ENTRY: CachedAnalysis = {
  storedAt: 1,
  result: {
    booth: {
      boothNumber: 'A-1',
      circleName: null,
      eventName: null,
      zone: null,
      isMailOrder: false,
    },
    currency: 'KRW',
    items: [],
    meta: { provider: 'openai', model: 'm', latencyMs: 1, cached: false },
  },
};

function ai(patch: Partial<AISettings>): AISettings {
  return { ...DEFAULT_AI_SETTINGS, ...patch };
}

describe('isAIConfigured', () => {
  it('needs a provider', () => {
    expect(isAIConfigured(DEFAULT_AI_SETTINGS)).toBe(false);
  });

  it('needs a non-blank key for API providers', () => {
    expect(isAIConfigured(ai({ provider: 'openai' }))).toBe(false);
    expect(
      isAIConfigured(
        ai({ provider: 'openai', openai: { apiKey: '  ', model: null } })
      )
    ).toBe(false);
    expect(
      isAIConfigured(
        ai({ provider: 'anthropic', anthropic: { apiKey: 'k', model: null } })
      )
    ).toBe(true);
  });

  it('accepts the local CLI without a key', () => {
    expect(isAIConfigured(ai({ provider: 'cli' }))).toBe(true);
  });
});

describe('createDexieCacheStore', () => {
  let name = '';
  afterEach(async () => {
    if (name) await Dexie.delete(name);
  });

  it('round-trips entries and treats malformed ones as misses', async () => {
    name = `acorn-runtime-cache-${Date.now()}`;
    const database = createAppDatabase(name);
    await database.open();
    const cache = createAnalysisCache(database);
    const store = createDexieCacheStore(cache);

    await store.set('good', ENTRY);
    expect(await store.get('good')).toEqual(ENTRY);
    expect(await store.get('missing')).toBeUndefined();

    await cache.set('bad-shape', { result: 'x', storedAt: 1 });
    await cache.set('no-time', { result: ENTRY.result });
    await cache.set('scalar', 42);
    expect(await store.get('bad-shape')).toBeUndefined();
    expect(await store.get('no-time')).toBeUndefined();
    expect(await store.get('scalar')).toBeUndefined();
    database.close();
  });
});

describe('ensureAIRuntime', () => {
  it('registers the CLI provider once and prunes once', async () => {
    const prune = vi.fn(async () => 0);
    ensureAIRuntime({ prune });
    ensureAIRuntime({ prune });
    expect(prune).toHaveBeenCalledTimes(1);
    expect(getProvider('cli').id).toBe('cli');
  });

  it('keeps the CLI target in sync with settings', () => {
    setRuntimeAISettings(ai({ cli: { target: 'codex', model: null } }));
    expect(getRuntimeCliTarget()).toBe('codex');
    expect(getProvider('cli').defaultModel('fast')).toBe('');
    setRuntimeAISettings(ai({ cli: { target: 'claude', model: null } }));
    expect(getProvider('cli').defaultModel('fast')).toBe('sonnet');
  });
});
