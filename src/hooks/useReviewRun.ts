/**
 * The AI run behind a review sheet (ACORN-7), shared by the capture review
 * and the booth re-analysis: starting, retrying and re-running the
 * extraction, streaming its rows into the sheet's review list, and the
 * image URLs the run could not read.
 */
import { useEffect, useMemo, useRef, type Dispatch } from 'react';
import type { ReviewAction } from '@/components/analysis/items-review-state';
import { isAIConfigured } from '@/lib/ai/runtime';
import type { ModelTier } from '@/lib/ai/types';
import type { AppSettings } from '@/lib/settings-types';
import {
  useExtraction,
  type ExtractFn,
  type ExtractionInput,
  type ExtractionState,
} from './useExtraction';

export interface UseReviewRunOptions {
  settings: AppSettings | null;
  /** Dispatch of the sheet's review list (reviewReducer). */
  dispatchRows: Dispatch<ReviewAction>;
  /** knownItemKey()s of items the booth already has; they start unchecked. */
  known?: ReadonlySet<string>;
  /** Injected in tests; defaults to the engine. */
  extract?: ExtractFn;
}

export interface ReviewRun {
  state: ExtractionState;
  /** An AI provider is connected. */
  configured: boolean;
  running: boolean;
  /** A first run, on the settings' tier. */
  start: (input: ExtractionInput) => void;
  /**
   * After an error or a stop: the last run's tier unless another is given.
   * Calls that already finished are answered from the cache.
   */
  retry: (input: ExtractionInput, tier?: ModelTier) => void;
  /**
   * After a finished run ("Analyze again", "Run accurate"): the last run's
   * tier unless another is given. The same tier re-analyzes without reading
   * the cache; another tier may still use it. Rows the user edited stay.
   */
  runAgain: (input: ExtractionInput, tier?: ModelTier) => void;
  cancel: () => void;
  /** URLs of images the finished run could not read. */
  skippedUrls: ReadonlySet<string>;
}

export function useReviewRun({
  settings,
  dispatchRows,
  known,
  extract,
}: UseReviewRunOptions): ReviewRun {
  const extraction = useExtraction({ settings, ...(extract ? { extract } : {}) });
  const { state, start, cancel } = extraction;
  const knownRef = useRef(known);
  knownRef.current = known;

  // Streamed rows into the review list, merged by row key: a re-run keeps
  // the rows (and the user's edits) it finds again. Rows only grow while a
  // run is under way; the finished run's list is final and drops untouched
  // rows it no longer has.
  useEffect(() => {
    if (state.status === 'idle') return;
    dispatchRows({
      type: 'sync',
      rows: state.rows.map((row) => ({ key: row.key, item: row.item, currency: row.currency })),
      known: knownRef.current,
      prune: state.status === 'done',
    });
  }, [state.status, state.rows, dispatchRows]);

  const skippedUrls = useMemo(() => {
    const urls = new Set<string>();
    if (state.status !== 'done') return urls;
    for (const index of state.outcome?.meta.skippedImages ?? []) {
      const url = state.images[index];
      if (url !== undefined) urls.add(url);
    }
    return urls;
  }, [state.status, state.outcome, state.images]);

  return {
    state,
    configured: settings ? isAIConfigured(settings.ai) : false,
    running: state.status === 'preparing' || state.status === 'streaming',
    start: (input) => start(input),
    retry: (input, tier) => start(input, { tier: tier ?? state.tier }),
    runAgain: (input, tier) => {
      const next = tier ?? state.tier;
      start(input, { tier: next, fresh: next === state.tier });
    },
    cancel,
    skippedUrls,
  };
}
