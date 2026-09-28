/**
 * Extraction engine (ADR-001 section 3): resolve provider/model/key from
 * settings, prepare images for the model (skipping ones that cannot be
 * loaded), then run one call per image in parallel (call #1 also carries the
 * post text and the hints), each answered from the local cache when
 * possible. Every call streams its own partial items with its currency, and
 * the result keeps each call's items and currency (`calls`) next to the
 * deterministic merge. Every failure surfaces as AIError.
 */
import type { AppLanguage } from '@/i18n/languages';
import type { AISettings } from '@/lib/settings-types';
// The submodule, not '@/i18n': the barrel pulls in React.
import { normalizeCurrencyCode } from '@/i18n/format';
import { cacheKey, type AnalysisCacheStore, type CachedAnalysis } from './cache';
import { sha256Hex } from './encoding';
import { abortedError, toAIError } from './errors';
import { isRecord, numberField } from './guards';
import { prepareImages, type DecodedImage, type ImageCodec, type PreparedImages } from './image';
import { mergeWire } from './merge';
import { imageLimitsFor } from './models';
import { parsePartialWire } from './partial-json';
import { buildUserContent, systemPromptFor } from './prompt';
import { getProvider } from './providers';
import {
  dedupeItems,
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
  type ExtractionCall,
  type ExtractionRequest,
  type ExtractionResult,
  type ModelTier,
  type PartialExtraction,
  type ProviderId,
  type WireExtraction,
} from './types';

/**
 * Per-call budgets, combined with the caller's signal: a call is aborted after
 * `idleMs` without streamed output (every text delta resets it) or after
 * `totalMs` overall. The engine only observes text deltas (`onText`), and
 * reasoning runs silently before the first one, so the accurate tier gets a
 * longer quiet period.
 */
export const CALL_TIMEOUTS: Readonly<Record<ModelTier, { idleMs: number; totalMs: number }>> = {
  fast: { idleMs: 30_000, totalMs: 180_000 },
  accurate: { idleMs: 60_000, totalMs: 300_000 },
};
/** Bound on downloading and preparing all images; images still pending are skipped. */
export const IMAGE_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1000;
/** One retry for retryable failures (rate_limit, network, timeout, unavailable). */
const MAX_ATTEMPTS = 2;

export interface ExtractBoothInput {
  /** Post text in its original language; may be empty when images are given. */
  text: string;
  /** Image URLs (fetched without credentials) or blobs, in display order. */
  images: ReadonlyArray<string | Blob>;
  targetLanguage: AppLanguage;
  /** Sent with the first call only, together with the post text. */
  hints?: ExtractionRequest['hints'];
  signal?: AbortSignal;
  /**
   * One call's items so far, with its currency once parsed. Fires when the
   * call's item count grows or its currency arrives; a call answered from
   * the cache reports everything at once. `call.index` is the call's
   * position in ExtractionResult.calls.
   */
  onPartial?: (partial: PartialExtraction, call: CallInfo) => void;
}

/** Which call a partial update belongs to. */
export interface CallInfo {
  /** Position in ExtractionResult.calls. */
  index: number;
  /** Index into the requested images; null for a text-only call. */
  imageIndex: number | null;
}

export interface ExtractBoothOptions {
  settings: AISettings;
  cache?: AnalysisCacheStore;
  /** Clock for latency and cache timestamps (epoch ms). */
  now?: () => number;
  /** Image decoder/encoder; defaults to createImageBitmap + OffscreenCanvas. */
  codec?: ImageCodec<DecodedImage>;
  /** Per-call inactivity limit; defaults to CALL_TIMEOUTS[tier].idleMs. */
  idleTimeoutMs?: number;
  /** Per-call overall limit; defaults to CALL_TIMEOUTS[tier].totalMs. */
  callTimeoutMs?: number;
  /** Image preparation limit; defaults to IMAGE_TIMEOUT_MS. */
  imageTimeoutMs?: number;
  retryDelayMs?: number;
  /** Skips cache reads (an explicit re-analysis); fresh results are still cached. */
  bypassCacheRead?: boolean;
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

interface Deadline {
  signal: AbortSignal;
  /** Records activity, restarting the idle timer. */
  touch(): void;
  dispose(): void;
}

/**
 * A child signal that aborts with the parent, or with a TimeoutError after
 * `totalMs`, or (when `idleMs` is given) after `idleMs` without `touch()`.
 */
function deadline(parent: AbortSignal | undefined, totalMs: number, idleMs?: number): Deadline {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent?.reason);
  if (parent?.aborted) onAbort();
  else parent?.addEventListener('abort', onAbort, { once: true });
  const expire = (message: string) => () =>
    controller.abort(new DOMException(message, 'TimeoutError'));
  const total = setTimeout(expire(`No complete response within ${totalMs} ms`), totalMs);
  let idle: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const touch = () => {
    if (idleMs === undefined || !active || controller.signal.aborted) return;
    clearTimeout(idle);
    idle = setTimeout(expire(`No data for ${idleMs} ms`), idleMs);
  };
  touch();
  return {
    signal: controller.signal,
    touch,
    dispose() {
      active = false;
      clearTimeout(total);
      clearTimeout(idle);
      parent?.removeEventListener('abort', onAbort);
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

/** Currency of a streamed wire prefix: undefined until its value has arrived. */
function streamedCurrency(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? normalizeCurrencyCode(raw) : null;
}

type PartialListener = NonNullable<ExtractBoothInput['onPartial']>;

/** Turns each call's streamed text into that call's partial items and currency. */
class PartialItems {
  private readonly items: WireItem[][];
  private readonly currencies: Array<string | null | undefined>;
  private readonly scanned: number[];
  private readonly emittedCount: number[];
  private readonly emittedCurrency: Array<string | null | undefined>;

  constructor(
    private readonly calls: readonly CallInfo[],
    private readonly listener: PartialListener | undefined
  ) {
    const n = calls.length;
    this.items = Array.from({ length: n }, () => []);
    this.currencies = new Array<string | null | undefined>(n).fill(undefined);
    this.scanned = new Array<number>(n).fill(0);
    this.emittedCount = new Array<number>(n).fill(0);
    this.emittedCurrency = new Array<string | null | undefined>(n).fill(undefined);
  }

  /** A retried call streams from scratch; what was already reported stays. */
  reset(call: number): void {
    this.items[call] = [];
    this.scanned[call] = 0;
  }

  update(call: number, text: string): void {
    if (!this.listener) return;
    const from = Math.min(this.scanned[call] ?? 0, text.length);
    this.scanned[call] = text.length;
    // Once the currency is known, only a closing brace can complete an item.
    if (this.currencies[call] !== undefined && text.indexOf('}', from) === -1) return;
    const parsed = parsePartialWire(text);
    const currency = streamedCurrency(parsed.currency);
    if (currency !== undefined) this.currencies[call] = currency;
    this.items[call] = dedupeItems(
      parsed.items.map(normalizeWireItem).filter((item): item is WireItem => item !== null)
    );
    this.emit(call);
  }

  /** Reports a call answered from the cache in one go. */
  complete(call: number, wire: WireExtraction): void {
    this.items[call] = wire.items;
    this.currencies[call] = wire.currency;
    this.emit(call);
  }

  private emit(call: number): void {
    const info = this.calls[call];
    const items = this.items[call] ?? [];
    const currency = this.currencies[call];
    const grew = items.length > (this.emittedCount[call] ?? 0);
    const newCurrency = currency !== undefined && currency !== this.emittedCurrency[call];
    if (!info || (!grew && !newCurrency)) return;
    this.emittedCount[call] = Math.max(items.length, this.emittedCount[call] ?? 0);
    this.emittedCurrency[call] = currency;
    try {
      this.listener?.(
        {
          items: items.map(toExtractedItem),
          ...(currency !== undefined ? { currency } : {}),
        },
        info
      );
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

/** One call's validated output, fresh or from the cache. */
interface CallOutcome {
  wire: WireExtraction;
  model: string;
  cached: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Re-validates a cache hit, since persistent stores can hold entries from an
 * older build or corrupted data: the entry must have the ExtractionResult
 * shape and pass validateWire with every item intact. Undefined means a miss.
 */
function validCachedCall(entry: unknown): CallOutcome | undefined {
  const result = isRecord(entry) ? entry.result : undefined;
  if (!isRecord(result) || !isRecord(result.booth) || !isRecord(result.meta)) return undefined;
  const { booth, meta, items } = result;
  if (!Array.isArray(items) || typeof meta.model !== 'string') return undefined;
  let wire: WireExtraction;
  try {
    wire = validateWire({
      booth: {
        number: booth.boothNumber,
        circle: booth.circleName,
        event: booth.eventName,
        zone: booth.zone,
        mailOrder: booth.isMailOrder,
      },
      currency: result.currency,
      items: items.map((item: unknown) =>
        isRecord(item)
          ? { name: item.name, orig: item.originalName, price: item.price, cat: item.category, opts: item.options }
          : null
      ),
    });
  } catch {
    return undefined;
  }
  // validateWire drops unusable items; a partly corrupt entry is still a miss.
  if (wire.items.length !== items.length) return undefined;
  const inputTokens = numberField(meta.inputTokens);
  const outputTokens = numberField(meta.outputTokens);
  return {
    wire,
    model: meta.model,
    cached: true,
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
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

/** One provider call of a run. */
interface PlannedCall {
  info: CallInfo;
  request: ExtractionRequest;
  /** Cache key over exactly what this call sends. */
  key: string;
}

interface CallPlan {
  target: Target;
  calls: readonly PlannedCall[];
  signal: AbortSignal | undefined;
  partials: PartialItems;
  cache: AnalysisCacheStore | undefined;
  now: () => number;
  idleMs: number;
  totalMs: number;
  retryDelayMs: number;
}

/**
 * Runs the calls in parallel and caches each one as it succeeds; the first
 * failure aborts the rest.
 */
async function runCalls(plan: CallPlan): Promise<CallOutcome[]> {
  const { target, signal: caller } = plan;
  const providerId = target.provider.id;
  const group = new AbortController();
  const onCallerAbort = () => group.abort(caller?.reason);
  if (caller?.aborted) onCallerAbort();
  else caller?.addEventListener('abort', onCallerAbort, { once: true });

  const runOne = async ({ info, request, key }: PlannedCall): Promise<CallOutcome> => {
    const startedAt = plan.now();
    for (let attempt = 1; ; attempt++) {
      plan.partials.reset(info.index);
      const call = deadline(group.signal, plan.totalMs, plan.idleMs);
      try {
        const raw = await target.provider.extract(
          { ...request, signal: call.signal },
          {
            apiKey: target.apiKey,
            model: target.model,
            signal: call.signal,
            onText: (text) => {
              call.touch();
              plan.partials.update(info.index, text);
            },
          }
        );
        const outcome: CallOutcome = {
          wire: validateWire(raw.wire, providerId),
          model: raw.model,
          cached: false,
          ...(raw.inputTokens !== undefined ? { inputTokens: raw.inputTokens } : {}),
          ...(raw.outputTokens !== undefined ? { outputTokens: raw.outputTokens } : {}),
        };
        const result = toResult(outcome.wire, {
          provider: providerId,
          model: outcome.model,
          latencyMs: plan.now() - startedAt,
          cached: false,
          ...(outcome.inputTokens !== undefined ? { inputTokens: outcome.inputTokens } : {}),
          ...(outcome.outputTokens !== undefined ? { outputTokens: outcome.outputTokens } : {}),
        });
        await writeCache(plan.cache, key, { result, storedAt: plan.now() });
        return outcome;
      } catch (error) {
        const aiError = toAIError(error, providerId, call.signal);
        if (attempt >= MAX_ATTEMPTS || !aiError.retryable || group.signal.aborted) throw aiError;
      } finally {
        call.dispose();
      }
      await delay(plan.retryDelayMs * attempt, group.signal, providerId);
    }
  };

  try {
    return await Promise.all(
      plan.calls.map((call) =>
        runOne(call).catch((error: unknown) => {
          group.abort(new DOMException('Another extraction call failed', 'AbortError'));
          throw error;
        })
      )
    );
  } finally {
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Cache key of one call: a hash of exactly the prompt it sends (system
 * prompt, user content with any hints, tier) plus its image. Image-only
 * calls carry no hints, so a changed event list or event currency only
 * re-runs the text-bearing call.
 */
async function callKey(
  target: Target,
  language: AppLanguage,
  tier: ModelTier,
  request: ExtractionRequest
): Promise<string> {
  const promptHash = await sha256Hex(
    JSON.stringify([systemPromptFor(language), buildUserContent(request.text, request.hints), tier])
  );
  return cacheKey(
    target.provider.id,
    target.model,
    SCHEMA_VERSION,
    promptHash,
    request.images.map((image) => image.hash)
  );
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

  // Image downloads get their own bound so a stalled URL cannot hang analysis.
  // Cancellation rejects here and aborts downloads still in flight.
  const prep = deadline(input.signal, options.imageTimeoutMs ?? IMAGE_TIMEOUT_MS);
  let prepared: PreparedImages;
  try {
    prepared = await prepareImages(input.images, {
      ...imageLimitsFor(target.model),
      signal: prep.signal,
      codec: options.codec,
    });
  } finally {
    prep.dispose();
  }
  if (input.signal?.aborted) throw abortedError(input.signal, providerId);
  const { images, skipped } = prepared;
  // Images that failed to load are dropped (the first one left carries the
  // text); fail only when nothing is left.
  if (images.length === 0 && input.text.trim() === '') {
    throw prepared.firstError ?? new AIError('unknown', 'No image could be loaded', providerId);
  }
  const skippedSet = new Set(skipped);
  const loadedIndices = input.images.map((_, index) => index).filter((index) => !skippedSet.has(index));

  const base = { targetLanguage: input.targetLanguage, tier: settings.tier };
  const lead: ExtractionRequest = { ...base, text: input.text, images: [], hints: input.hints };
  const requests: Array<{ info: CallInfo; request: ExtractionRequest }> =
    images.length === 0
      ? [{ info: { index: 0, imageIndex: null }, request: lead }]
      : images.map((image, index) => ({
          info: { index, imageIndex: loadedIndices[index] ?? index },
          // Only the first call carries the text and the hints.
          request: index === 0 ? { ...lead, images: [image] } : { ...base, text: '', images: [image] },
        }));
  const planned: PlannedCall[] = await Promise.all(
    requests.map(async ({ info, request }) => ({
      info,
      request,
      key: await callKey(target, input.targetLanguage, settings.tier, request),
    }))
  );

  const partials = new PartialItems(
    planned.map((call) => call.info),
    input.onPartial
  );
  const outcomes = new Array<CallOutcome | undefined>(planned.length);
  if (!options.bypassCacheRead) {
    const hits = await Promise.all(
      planned.map(async (call) => validCachedCall(await readCache(options.cache, call.key)))
    );
    hits.forEach((hit, index) => {
      if (!hit) return;
      outcomes[index] = hit;
      partials.complete(index, hit.wire);
    });
    if (input.signal?.aborted) throw abortedError(input.signal, providerId);
  }

  const misses = planned.filter((_, index) => outcomes[index] === undefined);
  const fresh = await runCalls({
    target,
    calls: misses,
    signal: input.signal,
    partials,
    cache: options.cache,
    now,
    idleMs: options.idleTimeoutMs ?? CALL_TIMEOUTS[settings.tier].idleMs,
    totalMs: options.callTimeoutMs ?? CALL_TIMEOUTS[settings.tier].totalMs,
    retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
  });
  misses.forEach((call, index) => {
    outcomes[call.info.index] = fresh[index];
  });

  const done = outcomes.filter((outcome): outcome is CallOutcome => outcome !== undefined);
  const spent = done.filter((outcome) => !outcome.cached);
  const inputTokens = sumDefined(spent.map((outcome) => outcome.inputTokens));
  const outputTokens = sumDefined(spent.map((outcome) => outcome.outputTokens));
  const calls: ExtractionCall[] = planned.map((call, index) => ({
    imageIndex: call.info.imageIndex,
    currency: outcomes[index]?.wire.currency ?? null,
    items: (outcomes[index]?.wire.items ?? []).map(toExtractedItem),
  }));
  return {
    ...toResult(mergeWire(done.map((outcome) => outcome.wire)), {
      provider: providerId,
      model: done[0]?.model ?? target.model,
      latencyMs: now() - startedAt,
      cached: done.every((outcome) => outcome.cached),
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(skipped.length > 0 ? { skippedImages: skipped } : {}),
    }),
    calls,
  };
}
