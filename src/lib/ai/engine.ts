/**
 * Extraction engine (ADR-001 section 3): resolve provider/model/key from
 * settings, prepare images for the model, serve from the local cache when
 * possible, otherwise fan out one call per image in parallel (call #1 also
 * carries the post text), stream merged partial items, merge deterministically
 * and cache the result. Every failure surfaces as AIError.
 */
import type { AppLanguage } from '@/i18n/languages';
import type { AISettings } from '@/lib/settings-types';
import { cacheKey, type AnalysisCacheStore, type CachedAnalysis } from './cache';
import { sha256Hex } from './encoding';
import { abortedError, toAIError } from './errors';
import { prepareImages, type DecodedImage, type ImageCodec } from './image';
import { mergeItems, mergeWire } from './merge';
import { imageLimitsFor } from './models';
import { extractClosedItems } from './partial-json';
import { buildUserContent, systemPromptFor } from './prompt';
import { getProvider } from './providers';
import {
  normalizeWireItem,
  SCHEMA_VERSION,
  toExtractedItem,
  toResult,
  validateWire,
  type WireItem,
} from './schema';
import {
  AIError,
  type AIProvider,
  type ExtractionRequest,
  type ExtractionResult,
  type PartialExtraction,
  type ProviderId,
  type ProviderRawResult,
} from './types';

/** Per-call budget; combined with the caller's signal. */
export const CALL_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1000;
/** One retry for retryable failures (rate_limit, network, timeout, unavailable). */
const MAX_ATTEMPTS = 2;

export interface ExtractBoothInput {
  /** Post text in its original language; may be empty when images are given. */
  text: string;
  /** Image URLs (fetched without credentials) or blobs, in display order. */
  images: ReadonlyArray<string | Blob>;
  targetLanguage: AppLanguage;
  hints?: ExtractionRequest['hints'];
  signal?: AbortSignal;
  /** Merged items so far across all calls; fires when the count grows. */
  onPartial?: (partial: PartialExtraction) => void;
}

export interface ExtractBoothOptions {
  settings: AISettings;
  cache?: AnalysisCacheStore;
  /** Clock for latency and cache timestamps (epoch ms). */
  now?: () => number;
  /** Image decoder/encoder; defaults to createImageBitmap + OffscreenCanvas. */
  codec?: ImageCodec<DecodedImage>;
  callTimeoutMs?: number;
  retryDelayMs?: number;
}

interface Target {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/** Throws AIError('not_configured') when no usable provider/key is set. */
export function resolveTarget(settings: AISettings): Target {
  const id = settings.provider;
  if (id === null) throw new AIError('not_configured', 'No AI provider is connected');
  const provider = getProvider(id);
  if (id === 'cli') {
    // The local CLI bridge authenticates through the user's own CLI login.
    const model = settings.cli.model?.trim() || provider.defaultModel(settings.tier);
    return { provider, model, apiKey: '' };
  }
  const config = settings[id];
  const apiKey = config.apiKey.trim();
  if (apiKey === '') throw new AIError('not_configured', `No API key is set for ${id}`, id);
  const model = config.model?.trim() || provider.defaultModel(settings.tier);
  return { provider, model, apiKey };
}

/** A child signal that aborts with the parent or with a TimeoutError after `ms`. */
function callSignal(parent: AbortSignal, ms: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent.reason);
  if (parent.aborted) onAbort();
  else parent.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException(`No response within ${ms} ms`, 'TimeoutError')),
    ms
  );
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parent.removeEventListener('abort', onAbort);
    },
  };
}

function delay(ms: number, signal: AbortSignal, provider: ProviderId): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedError(signal, provider));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortedError(signal, provider));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Turns per-call streamed text into merged partial items. */
class PartialItems {
  private readonly perCall: WireItem[][];
  private readonly scanned: number[];
  private emitted = 0;

  constructor(
    calls: number,
    private readonly onPartial: ((partial: PartialExtraction) => void) | undefined
  ) {
    this.perCall = Array.from({ length: calls }, () => []);
    this.scanned = new Array<number>(calls).fill(0);
  }

  /** A retried call streams from scratch. */
  reset(call: number): void {
    this.perCall[call] = [];
    this.scanned[call] = 0;
  }

  update(call: number, text: string): void {
    if (!this.onPartial) return;
    const from = Math.min(this.scanned[call] ?? 0, text.length);
    this.scanned[call] = text.length;
    // Items only complete when a closing brace arrives; skip other deltas.
    if (text.indexOf('}', from) === -1) return;
    this.perCall[call] = extractClosedItems(text)
      .map(normalizeWireItem)
      .filter((item): item is WireItem => item !== null);
    const merged = mergeItems(this.perCall);
    if (merged.length <= this.emitted) return;
    this.emitted = merged.length;
    try {
      this.onPartial({ items: merged.map(toExtractedItem) });
    } catch {
      // Partial updates are best effort; a UI callback bug must not fail extraction.
    }
  }
}

async function readCache(
  cache: AnalysisCacheStore | undefined,
  key: string
): Promise<CachedAnalysis | undefined> {
  try {
    return await cache?.get(key);
  } catch {
    return undefined; // The cache is an optimization; a broken store means a miss.
  }
}

async function writeCache(
  cache: AnalysisCacheStore | undefined,
  key: string,
  value: CachedAnalysis
): Promise<void> {
  try {
    await cache?.set(key, value);
  } catch {
    // Same as readCache: the fresh result is still returned.
  }
}

function sumDefined(values: ReadonlyArray<number | undefined>): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length === 0 ? undefined : defined.reduce((a, b) => a + b, 0);
}

interface CallPlan {
  target: Target;
  requests: ExtractionRequest[];
  signal: AbortSignal | undefined;
  onPartial: ExtractBoothInput['onPartial'];
  timeoutMs: number;
  retryDelayMs: number;
}

/** Runs all calls in parallel; the first failure aborts the rest. */
async function runCalls(plan: CallPlan): Promise<ProviderRawResult[]> {
  const { target, requests, signal: caller } = plan;
  const group = new AbortController();
  const onCallerAbort = () => group.abort(caller?.reason);
  if (caller?.aborted) onCallerAbort();
  else caller?.addEventListener('abort', onCallerAbort, { once: true });
  const partials = new PartialItems(requests.length, plan.onPartial);

  const runOne = async (request: ExtractionRequest, index: number): Promise<ProviderRawResult> => {
    for (let attempt = 1; ; attempt++) {
      partials.reset(index);
      const call = callSignal(group.signal, plan.timeoutMs);
      try {
        return await target.provider.extract(
          { ...request, signal: call.signal },
          {
            apiKey: target.apiKey,
            model: target.model,
            signal: call.signal,
            onText: (text) => partials.update(index, text),
          }
        );
      } catch (error) {
        const aiError = toAIError(error, target.provider.id, call.signal);
        if (attempt >= MAX_ATTEMPTS || !aiError.retryable || group.signal.aborted) throw aiError;
      } finally {
        call.dispose();
      }
      await delay(plan.retryDelayMs * attempt, group.signal, target.provider.id);
    }
  };

  try {
    return await Promise.all(
      requests.map((request, index) =>
        runOne(request, index).catch((error: unknown) => {
          group.abort(new DOMException('Another extraction call failed', 'AbortError'));
          throw error;
        })
      )
    );
  } finally {
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

export async function extractBooth(
  input: ExtractBoothInput,
  options: ExtractBoothOptions
): Promise<ExtractionResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const { settings } = options;
  const target = resolveTarget(settings);
  const providerId = target.provider.id;
  if (input.signal?.aborted) throw abortedError(input.signal, providerId);
  if (input.text.trim() === '' && input.images.length === 0) {
    throw new AIError('unknown', 'Nothing to analyze: no text and no images', providerId);
  }

  const images = await prepareImages(input.images, {
    ...imageLimitsFor(target.model),
    signal: input.signal,
    codec: options.codec,
  });

  const textHash = await sha256Hex(
    JSON.stringify([
      systemPromptFor(input.targetLanguage),
      buildUserContent(input.text, input.hints),
      settings.tier,
    ])
  );
  const key = await cacheKey(
    providerId,
    target.model,
    SCHEMA_VERSION,
    textHash,
    images.map((image) => image.hash)
  );
  const cached = await readCache(options.cache, key);
  if (cached) {
    return {
      ...cached.result,
      meta: { ...cached.result.meta, cached: true, latencyMs: now() - startedAt },
    };
  }

  const base = { targetLanguage: input.targetLanguage, tier: settings.tier, hints: input.hints };
  const requests: ExtractionRequest[] =
    images.length === 0
      ? [{ ...base, text: input.text, images: [] }]
      : images.map((image, index) => ({ ...base, text: index === 0 ? input.text : '', images: [image] }));

  const results = await runCalls({
    target,
    requests,
    signal: input.signal,
    onPartial: input.onPartial,
    timeoutMs: options.callTimeoutMs ?? CALL_TIMEOUT_MS,
    retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
  });

  const wire = mergeWire(results.map((r) => validateWire(r.wire, providerId)));
  const inputTokens = sumDefined(results.map((r) => r.inputTokens));
  const outputTokens = sumDefined(results.map((r) => r.outputTokens));
  const result = toResult(wire, {
    provider: providerId,
    model: results[0]?.model ?? target.model,
    latencyMs: now() - startedAt,
    cached: false,
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  });
  await writeCache(options.cache, key, { result, storedAt: now() });
  return result;
}
