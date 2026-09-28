/**
 * Side panel wiring of the AI layer (ACORN-7): registers the local CLI bridge
 * as provider 'cli' with the engine's own prompt and schema, and backs the
 * engine's analysis cache with the Dexie `analysisCache` table.
 *
 * Call ensureAIRuntime() once the database is open (App mount); it is
 * idempotent. setRuntimeAISettings() keeps the CLI target in sync with the
 * settings the next extraction runs with.
 */
import { analysisCache, type AnalysisCache } from '@/lib/analysis-cache';
import { createCliProvider } from '@/lib/bridge/provider';
import type { CliTarget } from '@/lib/bridge/protocol';
import {
  DEFAULT_AI_SETTINGS,
  type AISettings,
} from '@/lib/settings-types';
import type { AnalysisCacheStore, CachedAnalysis } from './cache';
import { isRecord } from './guards';
import { buildUserContent, systemPromptFor } from './prompt';
import { registerProvider } from './providers';
import { WIRE_SCHEMA } from './schema';

let cliTarget: CliTarget = DEFAULT_AI_SETTINGS.cli.target;
let registered = false;
let pruned = false;

/** Updates what the CLI provider reads on its next call. */
export function setRuntimeAISettings(ai: AISettings): void {
  cliTarget = ai.cli.target;
}

/** Target the CLI provider will run; exposed for tests. */
export function getRuntimeCliTarget(): CliTarget {
  return cliTarget;
}

/**
 * True when `ai` names a provider the engine can call: an API provider with
 * a key, or the local CLI (which authenticates through the user's own CLI).
 */
export function isAIConfigured(ai: AISettings): boolean {
  const provider = ai.provider;
  if (provider === null) return false;
  if (provider === 'cli') return true;
  return ai[provider].apiKey.trim() !== '';
}

/** Structural check of a stored entry; the engine re-validates the result. */
function isCachedAnalysis(value: unknown): value is CachedAnalysis {
  return (
    isRecord(value) &&
    isRecord(value.result) &&
    typeof value.storedAt === 'number' &&
    Number.isFinite(value.storedAt)
  );
}

/**
 * AnalysisCacheStore over a Dexie-backed AnalysisCache. Entries of the wrong
 * shape (older builds, corruption) read as misses.
 */
export function createDexieCacheStore(
  store: Pick<AnalysisCache, 'get' | 'set'>
): AnalysisCacheStore {
  return {
    async get(key) {
      const value = await store.get(key);
      return isCachedAnalysis(value) ? value : undefined;
    },
    async set(key, value) {
      await store.set(key, value);
    },
  };
}

const dexieStore = createDexieCacheStore(analysisCache);

/** The persistent cache the engine should use in the side panel. */
export function getAnalysisCache(): AnalysisCacheStore {
  return dexieStore;
}

/** Registers the CLI provider (once). Safe to call before the DB is open. */
export function registerCliProvider(): void {
  if (registered) return;
  registered = true;
  registerProvider(
    createCliProvider({
      getTarget: () => cliTarget,
      buildPrompt: (req) => ({
        system: systemPromptFor(req.targetLanguage),
        text: buildUserContent(req.text, req.hints),
      }),
      schema: WIRE_SCHEMA as unknown as Record<string, unknown>,
    })
  );
}

/**
 * One-time setup for the side panel: provider registration and a cache
 * prune in the background. Idempotent.
 */
export function ensureAIRuntime(
  cache: Pick<AnalysisCache, 'prune'> = analysisCache
): void {
  registerCliProvider();
  if (pruned) return;
  pruned = true;
  cache.prune().catch((error: unknown) => {
    console.warn('[ai] could not prune the analysis cache', error);
  });
}
