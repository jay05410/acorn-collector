/**
 * Local cache for AI analysis results, keyed by the caller (e.g. image hash +
 * model + schema version). Values are returned as `unknown`: callers must
 * validate them, because a cached shape can predate the current code.
 */
import { db, type AppDatabase } from './db';

export const ANALYSIS_CACHE_MAX_ENTRIES = 200;
export const ANALYSIS_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface PruneOptions {
  /** Keep at most this many newest entries. */
  maxEntries?: number;
  /** Drop entries older than this. */
  maxAgeMs?: number;
}

export interface AnalysisCache {
  /** Stored value, or undefined on a miss. */
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  /** Removes expired and excess entries; resolves to the number removed. */
  prune(options?: PruneOptions): Promise<number>;
}

export function createAnalysisCache(database: AppDatabase): AnalysisCache {
  const table = database.analysisCache;

  return {
    async get(key) {
      const entry = await table.get(key);
      return entry?.value;
    },

    async set(key, value) {
      await table.put({ key, value, createdAt: Date.now() });
    },

    async prune({
      maxEntries = ANALYSIS_CACHE_MAX_ENTRIES,
      maxAgeMs = ANALYSIS_CACHE_MAX_AGE_MS,
    } = {}) {
      return database.transaction('rw', table, async () => {
        const cutoff = Date.now() - maxAgeMs;
        const expired = await table.where('createdAt').below(cutoff).delete();

        const excess = (await table.count()) - Math.max(0, maxEntries);
        if (excess <= 0) return expired;

        const oldestKeys = await table
          .orderBy('createdAt')
          .limit(excess)
          .primaryKeys();
        await table.bulkDelete(oldestKeys);
        return expired + oldestKeys.length;
      });
    },
  };
}

export const analysisCache = createAnalysisCache(db);
