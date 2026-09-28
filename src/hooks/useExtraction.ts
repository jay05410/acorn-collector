/**
 * AI extraction for the review sheets (ACORN-7): a small state machine
 * idle -> preparing -> streaming -> done | error | cancelled around one
 * extractBooth run.
 *
 * The engine runs one call per image and reports each call's items with that
 * call's own currency, while streaming and in the result (`calls`). A post
 * can mix price lists (e.g. a Korean and a Japanese one), so every row keeps
 * the currency of the call it came from.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getLanguage } from '@/i18n';
import { extractBooth, resolveTarget } from '@/lib/ai/engine';
import { ensureAIRuntime, getAnalysisCache, setRuntimeAISettings } from '@/lib/ai/runtime';
import { normalizeName } from '@/lib/ai/schema';
import {
  AIError,
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
  /**
   * Stable for the item across partial updates, the final result and later
   * runs of the same sheet: `<image index or t>:<normalized name>|<price>`
   * of the call it first appeared in.
   */
  key: string;
  /** Index into ExtractionResult.calls of the call the item came from. */
  call: number;
  item: ExtractedItem;
  /** Currency of the call's prices: undefined while unknown, null when none. */
  currency: string | null | undefined;
}

/** What one engine call has reported so far. */
export interface CallRows {
  /** Index into the analyzed images; null for a text-only call. */
  imageIndex: number | null;
  items: ExtractedItem[];
  /** Undefined until the call's currency has been parsed. */
  currency: string | null | undefined;
}

/**
 * Row keys handed out so far. They are sticky: once an item is shown under a
 * key it keeps that key, so rows never swap keys (and user edits never land
 * on a duplicate) whatever order the calls stream in.
 */
export interface RowKeys {
  /** Own key of an item in a call -> the row key it is shown under. */
  own: Readonly<Record<string, string>>;
  /** Normalized name, price and known currency -> the row key showing it. */
  identity: Readonly<Record<string, string>>;
}

export type ExtractionOutcome = Pick<ExtractionResult, 'booth' | 'currency' | 'meta'>;

export interface ExtractionState {
  status: ExtractionStatus;
  /** Increases with every start; late events of older runs are ignored. */
  runId: number;
  tier: ModelTier;
  provider: ProviderId | null;
  model: string | null;
  /** Image URLs sent in this run; skipped image indices refer to this list. */
  images: readonly string[];
  startedAt: number | null;
  finishedAt: number | null;
  /** Per engine call (by call index), as reported so far. */
  calls: readonly (CallRows | undefined)[];
  rows: ExtractionRow[];
  /** Kept across runs, so a re-run lands on the rows the user already edited. */
  keys: RowKeys;
  outcome: ExtractionOutcome | null;
  error: AIError | null;
}

export const INITIAL_EXTRACTION_STATE: ExtractionState = {
  status: 'idle',
  runId: 0,
  tier: 'fast',
  provider: null,
  model: null,
  images: [],
  startedAt: null,
  finishedAt: null,
  calls: [],
  rows: [],
  keys: { own: {}, identity: {} },
  outcome: null,
  error: null,
};

export type ExtractionAction =
  | {
      type: 'start';
      runId: number;
      at: number;
      images: readonly string[];
      tier: ModelTier;
      provider: ProviderId | null;
      model: string | null;
    }
  | {
      type: 'partial';
      runId: number;
      call: number;
      imageIndex: number | null;
      items: ExtractedItem[];
      /** Undefined when this update does not carry the currency (yet). */
      currency?: string | null;
    }
  | { type: 'done'; runId: number; at: number; result: ExtractionResult }
  | { type: 'fail'; runId: number; at: number; error: AIError };

/**
 * Flattens the calls' items in call order into rows. An item another call
 * already shows (same name and price, both currencies known and equal) is
 * shown once, under the key it got first; see RowKeys.
 */
export function assembleRows(
  calls: readonly (CallRows | undefined)[],
  keys: RowKeys
): { rows: ExtractionRow[]; keys: RowKeys } {
  const own: Record<string, string> = { ...keys.own };
  const identity: Record<string, string> = { ...keys.identity };
  const rows: ExtractionRow[] = [];
  const shown = new Set<string>();
  calls.forEach((call, index) => {
    if (!call) return;
    const source = call.imageIndex === null ? 't' : String(call.imageIndex);
    for (const item of call.items) {
      const name = normalizeName(item.name);
      const price = item.price ?? '';
      const ownKey = `${source}:${name}|${price}`;
      // Unknown currency: never merged with another call's item.
      const id = call.currency === undefined ? null : `${name}|${price}|${call.currency ?? ''}`;
      let key = own[ownKey];
      if (key === undefined) {
        key = (id !== null ? identity[id] : undefined) ?? ownKey;
        own[ownKey] = key;
      }
      if (id !== null) identity[id] ??= key;
      if (shown.has(key)) continue;
      shown.add(key);
      rows.push({ key, call: index, item, currency: call.currency });
    }
  });
  return { rows, keys: { own, identity } };
}

function withRows(state: ExtractionState, calls: readonly (CallRows | undefined)[]): ExtractionState {
  const { rows, keys } = assembleRows(calls, state.keys);
  return { ...state, calls, rows, keys };
}

/** Per-call lists of a finished run (a result without `calls` is one call). */
function finalCalls(state: ExtractionState, result: ExtractionResult): CallRows[] {
  if (result.calls) {
    return result.calls.map((call) => ({
      imageIndex: call.imageIndex,
      items: call.items,
      currency: call.currency,
    }));
  }
  return [
    {
      imageIndex: state.calls[0]?.imageIndex ?? null,
      items: result.items,
      currency: result.currency,
    },
  ];
}

export function extractionReducer(
  state: ExtractionState,
  action: ExtractionAction
): ExtractionState {
  if (action.type === 'start') {
    return {
      ...INITIAL_EXTRACTION_STATE,
      status: 'preparing',
      runId: action.runId,
      tier: action.tier,
      provider: action.provider,
      model: action.model,
      images: action.images,
      startedAt: action.at,
      keys: state.keys,
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
      const calls = [...state.calls];
      calls[action.call] = {
        imageIndex: action.imageIndex,
        items: action.items,
        currency: action.currency !== undefined ? action.currency : calls[action.call]?.currency,
      };
      return withRows({ ...state, status: 'streaming' }, calls);
    }
    case 'done': {
      const { result } = action;
      return withRows(
        {
          ...state,
          status: 'done',
          finishedAt: action.at,
          outcome: { booth: result.booth, currency: result.currency, meta: result.meta },
          provider: result.meta.provider,
          model: result.meta.model,
        },
        finalCalls(state, result)
      );
    }
    case 'fail':
      // Rows kept from the stream keep their currency, or stay unknown.
      return {
        ...state,
        status: action.error.code === 'cancelled' ? 'cancelled' : 'error',
        finishedAt: action.at,
        error: action.error.code === 'cancelled' ? null : action.error,
      };
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

/** Images actually sent: the CLI gets at most CLI_MAX_IMAGES. */
export function imagesFor(settings: AppSettings, images: readonly string[]): string[] {
  return settings.ai.provider === 'cli'
    ? images.slice(0, CLI_MAX_IMAGES)
    : [...images];
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
  /** Re-analyze without reading the cache (the fresh result is still stored). */
  fresh?: boolean;
}

export interface UseExtraction {
  state: ExtractionState;
  start: (input: ExtractionInput, options?: StartOptions) => void;
  cancel: () => void;
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

  const cancel = useCallback(() => {
    controllerRef.current?.abort(new DOMException('Cancelled by the user', 'AbortError'));
    controllerRef.current = null;
  }, []);

  const start = useCallback((input: ExtractionInput, options: StartOptions = {}) => {
    controllerRef.current?.abort(new DOMException('Superseded', 'AbortError'));
    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++runRef.current;
    const current = settingsRef.current;
    const tier = options.tier ?? current?.ai.tier ?? 'fast';
    ensureAIRuntime();
    if (current) setRuntimeAISettings(current.ai);
    const images = current ? imagesFor(current, input.images) : [...input.images];
    dispatch({
      type: 'start',
      runId,
      at: nowRef.current(),
      images,
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
    extractRef
      .current(
        {
          text: input.text,
          images,
          targetLanguage: getLanguage(),
          hints: input.hints,
          signal: controller.signal,
          onPartial: (partial, call) =>
            dispatch({
              type: 'partial',
              runId,
              call: call.index,
              imageIndex: call.imageIndex,
              items: partial.items,
              currency: partial.currency,
            }),
        },
        {
          settings: { ...current.ai, tier },
          cache: getAnalysisCache(),
          ...(options.fresh ? { bypassCacheRead: true } : {}),
        }
      )
      .then(
        (result) => dispatch({ type: 'done', runId, at: nowRef.current(), result }),
        (error: unknown) => {
          fail(
            controller.signal.aborted
              ? new AIError('cancelled', 'The analysis was cancelled')
              : error
          );
        }
      );
  }, []);

  // Cancel the run in flight when the sheet unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, start, cancel };
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
