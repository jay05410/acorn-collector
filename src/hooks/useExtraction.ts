/**
 * AI extraction for the review sheets (ACORN-7): a small state machine
 * idle -> preparing -> streaming -> done | error | cancelled around
 * extractBooth.
 *
 * The engine merges all images into one result with one currency. A post can
 * mix price lists (e.g. a Korean and a Japanese one), so this hook runs one
 * extractBooth per image, in parallel, exactly like the engine's own fan-out
 * (call #1 carries the post text), and keeps each call's currency on its
 * rows. Cost and latency are the same as a single multi-image call.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getLanguage } from '@/i18n';
import { extractBooth, resolveTarget } from '@/lib/ai/engine';
import { ensureAIRuntime, getAnalysisCache, setRuntimeAISettings } from '@/lib/ai/runtime';
import { normalizeName } from '@/lib/ai/schema';
import {
  AIError,
  type ExtractedBooth,
  type ExtractedItem,
  type ExtractionRequest,
  type ExtractionResult,
  type ModelTier,
  type ProviderId,
} from '@/lib/ai/types';
import type { AppSettings } from '@/lib/settings-types';

export type ExtractionStatus =
  | 'idle'
  | 'preparing'
  | 'streaming'
  | 'done'
  | 'error'
  | 'cancelled';

/** The local CLI runs one process per image; more than this is too slow. */
export const CLI_MAX_IMAGES = 6;

export interface ExtractionRow {
  /** Stable across partial updates and the final result. */
  key: string;
  /** Index of the call (image) the item came from. */
  call: number;
  item: ExtractedItem;
  /** Currency of the call's prices: undefined until the call finishes, null when none. */
  currency: string | null | undefined;
}

export interface ExtractionMetaSummary {
  provider: ProviderId;
  model: string;
  /** Slowest call (calls run in parallel). */
  latencyMs: number;
  /** Every call was served from the local cache. */
  cached: boolean;
  /** Indices into the analyzed image list that could not be read. */
  skippedImages: number[];
}

export interface ExtractionOutcome {
  booth: ExtractedBooth;
  /** First call's currency, else the first known one. */
  currency: string | null;
  meta: ExtractionMetaSummary;
}

export interface ExtractionState {
  status: ExtractionStatus;
  /** Increases with every start; late events of older runs are ignored. */
  runId: number;
  tier: ModelTier;
  provider: ProviderId | null;
  model: string | null;
  /** Images sent for analysis in this run. */
  imageCount: number;
  startedAt: number | null;
  finishedAt: number | null;
  /** Items per call as they stream in; a finished call holds its final list. */
  partial: ExtractedItem[][];
  /** Per-call currencies; undefined until the run finishes. */
  currencies: (string | null | undefined)[];
  rows: ExtractionRow[];
  outcome: ExtractionOutcome | null;
  error: AIError | null;
}

export const INITIAL_EXTRACTION_STATE: ExtractionState = {
  status: 'idle',
  runId: 0,
  tier: 'fast',
  provider: null,
  model: null,
  imageCount: 0,
  startedAt: null,
  finishedAt: null,
  partial: [],
  currencies: [],
  rows: [],
  outcome: null,
  error: null,
};

/** Result of one call; null when its image could not be loaded. */
export type CallResult = ExtractionResult | null;

export type ExtractionAction =
  | {
      type: 'start';
      runId: number;
      at: number;
      calls: number;
      imageCount: number;
      tier: ModelTier;
      provider: ProviderId | null;
      model: string | null;
    }
  | { type: 'partial'; runId: number; call: number; items: ExtractedItem[] }
  | { type: 'done'; runId: number; at: number; results: CallResult[] }
  | { type: 'fail'; runId: number; at: number; error: AIError }
  | { type: 'reset' };

function rowKey(call: number, item: ExtractedItem): string {
  return `${call}:${normalizeName(item.name)}|${item.price ?? ''}`;
}

/**
 * Flattens per-call items in call order. An item repeated on another image
 * (same name, price and currency) is kept once, at its first position.
 */
export function assembleRows(
  lists: readonly (readonly ExtractedItem[] | undefined)[],
  currencies: readonly (string | null | undefined)[]
): ExtractionRow[] {
  const rows: ExtractionRow[] = [];
  const seen = new Set<string>();
  lists.forEach((items, call) => {
    const currency = currencies[call];
    for (const item of items ?? []) {
      const identity = `${normalizeName(item.name)}|${item.price ?? ''}|${currency ?? ''}`;
      const key = rowKey(call, item);
      if (seen.has(identity) || seen.has(key)) continue;
      seen.add(identity);
      seen.add(key);
      rows.push({ key, call, item, currency });
    }
  });
  return rows;
}

function firstNonNull<T>(values: readonly (T | null | undefined)[]): T | null {
  for (const value of values) if (value !== null && value !== undefined) return value;
  return null;
}

/** Booth fields and meta over the calls, in call order (like mergeWire). */
export function summarizeResults(results: readonly CallResult[]): ExtractionOutcome | null {
  const done = results.filter((r): r is ExtractionResult => r !== null);
  const first = done[0];
  if (!first) return null;
  const booth = (field: Exclude<keyof ExtractedBooth, 'isMailOrder'>) =>
    firstNonNull(done.map((r) => r.booth[field]));
  const skippedImages: number[] = [];
  results.forEach((result, call) => {
    if (result === null || result.meta.skippedImages?.includes(0)) skippedImages.push(call);
  });
  return {
    booth: {
      boothNumber: booth('boothNumber'),
      circleName: booth('circleName'),
      eventName: booth('eventName'),
      zone: booth('zone'),
      isMailOrder: done.some((r) => r.booth.isMailOrder),
    },
    currency: firstNonNull(done.map((r) => r.currency)),
    meta: {
      provider: first.meta.provider,
      model: first.meta.model,
      latencyMs: Math.max(...done.map((r) => r.meta.latencyMs)),
      cached: done.every((r) => r.meta.cached),
      skippedImages,
    },
  };
}

export function extractionReducer(
  state: ExtractionState,
  action: ExtractionAction
): ExtractionState {
  if (action.type === 'reset') {
    return { ...INITIAL_EXTRACTION_STATE, runId: state.runId };
  }
  if (action.type === 'start') {
    return {
      ...INITIAL_EXTRACTION_STATE,
      status: 'preparing',
      runId: action.runId,
      tier: action.tier,
      provider: action.provider,
      model: action.model,
      imageCount: action.imageCount,
      startedAt: action.at,
      partial: Array.from({ length: action.calls }, () => []),
      currencies: new Array<string | null | undefined>(action.calls).fill(undefined),
    };
  }
  // Events of a superseded or finished run.
  if (
    action.runId !== state.runId ||
    (state.status !== 'preparing' && state.status !== 'streaming')
  ) {
    return state;
  }
  switch (action.type) {
    case 'partial': {
      const partial = state.partial.map((items, call) =>
        call === action.call ? action.items : items
      );
      return {
        ...state,
        status: 'streaming',
        partial,
        rows: assembleRows(partial, state.currencies),
      };
    }
    case 'done': {
      const partial = action.results.map((result) => result?.items ?? []);
      const currencies = action.results.map((result) => result?.currency ?? null);
      const outcome = summarizeResults(action.results);
      return {
        ...state,
        status: 'done',
        finishedAt: action.at,
        partial,
        currencies,
        rows: assembleRows(partial, currencies),
        outcome,
        provider: outcome?.meta.provider ?? state.provider,
        model: outcome?.meta.model ?? state.model,
      };
    }
    case 'fail': {
      // Rows kept from the stream fall back to the event currency.
      const currencies = state.currencies.map((currency) => currency ?? null);
      return {
        ...state,
        currencies,
        rows: assembleRows(state.partial, currencies),
        status: action.error.code === 'cancelled' ? 'cancelled' : 'error',
        finishedAt: action.at,
        error: action.error.code === 'cancelled' ? null : action.error,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Running

export interface ExtractionInput {
  /** Post text in its original language (may be empty). */
  text: string;
  /** Image URLs to analyze, in display order. */
  images: readonly string[];
  hints?: ExtractionRequest['hints'];
}

export type ExtractFn = typeof extractBooth;

interface RunPlan {
  input: ExtractionInput;
  settings: AppSettings;
  tier: ModelTier;
  signal: AbortSignal;
  extract: ExtractFn;
  onPartial: (call: number, items: ExtractedItem[]) => void;
}

/** An image the engine could not download or decode (no provider involved). */
function isImageLoadError(error: unknown): boolean {
  return (
    error instanceof AIError &&
    error.provider === undefined &&
    error.code !== 'cancelled' &&
    error.code !== 'not_configured'
  );
}

/** Images actually sent: the CLI gets at most CLI_MAX_IMAGES. */
export function imagesFor(settings: AppSettings, images: readonly string[]): string[] {
  return settings.ai.provider === 'cli'
    ? images.slice(0, CLI_MAX_IMAGES)
    : [...images];
}

/**
 * One extractBooth per image (text on the first), in parallel. The first
 * failure aborts the others, as in the engine. A later image that cannot be
 * loaded yields null (reported as skipped) instead of failing the run.
 */
export async function runExtractionCalls(plan: RunPlan): Promise<CallResult[]> {
  const { input, settings, signal, extract } = plan;
  const images = imagesFor(settings, input.images);
  const ai = { ...settings.ai, tier: plan.tier };
  const group = new AbortController();
  const onAbort = () => group.abort(signal.reason);
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });

  const calls: Array<{ text: string; images: string[] }> =
    images.length === 0
      ? [{ text: input.text, images: [] }]
      : images.map((url, index) => ({ text: index === 0 ? input.text : '', images: [url] }));

  try {
    return await Promise.all(
      calls.map(async (call, index) => {
        try {
          return await extract(
            {
              text: call.text,
              images: call.images,
              targetLanguage: getLanguage(),
              hints: input.hints,
              signal: group.signal,
              onPartial: ({ items }) => plan.onPartial(index, items),
            },
            { settings: ai, cache: getAnalysisCache() }
          );
        } catch (error) {
          if (index > 0 && isImageLoadError(error) && !group.signal.aborted) return null;
          group.abort(new DOMException('Another extraction call failed', 'AbortError'));
          throw error;
        }
      })
    );
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export function asAIError(error: unknown): AIError {
  return error instanceof AIError
    ? error
    : new AIError('unknown', error instanceof Error ? error.message : 'Unknown error');
}

export interface UseExtractionOptions {
  /** Current settings; start() fails with not_configured while null. */
  settings: AppSettings | null;
  /** Injected in tests; defaults to the engine. */
  extract?: ExtractFn;
  now?: () => number;
}

export interface StartOptions {
  /** Overrides settings.ai.tier for this run. */
  tier?: ModelTier;
}

export interface UseExtraction {
  state: ExtractionState;
  start: (input: ExtractionInput, options?: StartOptions) => void;
  /** Re-runs the last input, optionally on another tier. */
  retry: (options?: StartOptions) => void;
  cancel: () => void;
  reset: () => void;
  /** Whether start() has an input to re-run. */
  canRetry: boolean;
}

/** Model the run will use, for the status chip; null when unknown. */
function plannedModel(settings: AppSettings, tier: ModelTier): string | null {
  try {
    return resolveTarget({ ...settings.ai, tier }).model || null;
  } catch {
    return null;
  }
}

export function useExtraction({
  settings,
  extract = extractBooth,
  now = Date.now,
}: UseExtractionOptions): UseExtraction {
  const [state, dispatch] = useReducer(extractionReducer, INITIAL_EXTRACTION_STATE);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const extractRef = useRef(extract);
  extractRef.current = extract;
  const nowRef = useRef(now);
  nowRef.current = now;
  const runRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const lastInput = useRef<ExtractionInput | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const cancel = useCallback(() => {
    controllerRef.current?.abort(new DOMException('Cancelled by the user', 'AbortError'));
    controllerRef.current = null;
  }, []);

  const start = useCallback((input: ExtractionInput, options: StartOptions = {}) => {
    controllerRef.current?.abort(new DOMException('Superseded', 'AbortError'));
    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++runRef.current;
    lastInput.current = input;
    setCanRetry(true);
    const current = settingsRef.current;
    const tier = options.tier ?? current?.ai.tier ?? 'fast';
    ensureAIRuntime();
    if (current) setRuntimeAISettings(current.ai);
    const images = current ? imagesFor(current, input.images) : [...input.images];
    dispatch({
      type: 'start',
      runId,
      at: nowRef.current(),
      calls: Math.max(1, images.length),
      imageCount: images.length,
      tier,
      provider: current?.ai.provider ?? null,
      model: current ? plannedModel(current, tier) : null,
    });

    const fail = (error: unknown) =>
      dispatch({ type: 'fail', runId, at: nowRef.current(), error: asAIError(error) });

    if (!current || current.ai.provider === null) {
      fail(new AIError('not_configured', 'No AI provider is connected'));
      return;
    }
    if (input.text.trim() === '' && images.length === 0) {
      fail(new AIError('unknown', 'Nothing to analyze'));
      return;
    }
    runExtractionCalls({
      input,
      settings: current,
      tier,
      signal: controller.signal,
      extract: extractRef.current,
      onPartial: (call, items) => dispatch({ type: 'partial', runId, call, items }),
    }).then(
      (results) => dispatch({ type: 'done', runId, at: nowRef.current(), results }),
      (error: unknown) => {
        if (controller.signal.aborted) {
          fail(new AIError('cancelled', 'The analysis was cancelled'));
        } else {
          fail(error);
        }
      }
    );
  }, []);

  const retry = useCallback(
    (options?: StartOptions) => {
      if (lastInput.current) start(lastInput.current, options);
    },
    [start]
  );

  const reset = useCallback(() => {
    cancel();
    runRef.current += 1;
    dispatch({ type: 'reset' });
  }, [cancel]);

  // Cancel the run in flight when the sheet unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, start, retry, cancel, reset, canRetry };
}

/** Milliseconds since the run started, ticking while it runs. */
export function useElapsed(state: ExtractionState, intervalMs = 100): number {
  const running = state.status === 'preparing' || state.status === 'streaming';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [running, intervalMs, state.runId]);
  if (state.startedAt === null) return 0;
  const end = running ? now : (state.finishedAt ?? now);
  return Math.max(0, end - state.startedAt);
}
