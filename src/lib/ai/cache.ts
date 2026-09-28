/**
 * Local analysis cache contract. The engine only needs get/set; ACORN-3's
 * Dexie table can implement AnalysisCacheStore, and the in-memory LRU here
 * serves the session (and tests).
 */
import { sha256Hex } from './encoding';
import type { ExtractionResult, ProviderId } from './types';

export interface CachedAnalysis {
  result: ExtractionResult;
  /** Epoch ms when stored; lets persistent stores expire entries. */
  storedAt: number;
}

export interface AnalysisCacheStore {
  get(key: string): Promise<CachedAnalysis | undefined>;
  set(key: string, value: CachedAnalysis): Promise<void>;
}

/**
 * SHA-256 over everything that changes the answer. `textHash` must cover the
 * full prompt (post text, target language, hints, tier) so a Korean run never
 * serves Japanese-translated names; image hashes keep call order because the
 * first call's booth fields win in the merge.
 */
export function cacheKey(
  provider: ProviderId,
  model: string,
  schemaVersion: number,
  textHash: string,
  imageHashes: readonly string[]
): Promise<string> {
  return sha256Hex(JSON.stringify([provider, model, schemaVersion, textHash, imageHashes]));
}

/** LRU store kept in memory; values are cloned so callers cannot mutate entries. */
export function createMemoryCacheStore(limit = 50): AnalysisCacheStore {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
  const entries = new Map<string, CachedAnalysis>();
  return {
    async get(key) {
      const value = entries.get(key);
      if (value === undefined) return undefined;
      entries.delete(key);
      entries.set(key, value);
      return structuredClone(value);
    },
    async set(key, value) {
      entries.delete(key);
      entries.set(key, structuredClone(value));
      while (entries.size > limit) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
  };
}
