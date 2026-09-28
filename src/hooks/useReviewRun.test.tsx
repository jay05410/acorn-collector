// @vitest-environment happy-dom
import { act, useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewReducer, type ReviewRow } from '@/components/analysis/items-review-state';
import { cleanup, render } from '@/components/ui/test-utils';
import type { ExtractBoothInput } from '@/lib/ai/engine';
import { AIError, type ExtractedItem, type ExtractionResult } from '@/lib/ai/types';
import type { AppSettings } from '@/lib/settings-types';
import { createDefaultSettings } from '@/lib/storage';
import type { ExtractFn, ExtractionInput } from './useExtraction';
import { useReviewRun, type ReviewRun } from './useReviewRun';

vi.mock('@/lib/ai/runtime', () => ({
  ensureAIRuntime: vi.fn(),
  setRuntimeAISettings: vi.fn(),
  getAnalysisCache: () => undefined,
  isAIConfigured: () => true,
}));

function item(name: string, price: number): ExtractedItem {
  return { name, originalName: null, price, category: 'other', options: [] };
}

function result(items: ExtractedItem[], meta: Partial<ExtractionResult['meta']> = {}): ExtractionResult {
  return {
    booth: { boothNumber: null, circleName: null, eventName: null, zone: null, isMailOrder: false },
    currency: 'KRW',
    items,
    meta: { provider: 'openai', model: 'm', latencyMs: 1, cached: false, ...meta },
    calls: [{ imageIndex: null, currency: 'KRW', items }],
  };
}

const SETTINGS: AppSettings = (() => {
  const base = createDefaultSettings();
  return { ...base, ai: { ...base.ai, provider: 'openai', openai: { apiKey: 'k', model: null } } };
})();

const INPUT: ExtractionInput = { text: 'post', images: [] };

let run: ReviewRun;
let rows: ReviewRow[];
let dispatchRows: (action: Parameters<typeof reviewReducer>[1]) => void;

function Probe({ extract }: { extract: ExtractFn }) {
  const [state, dispatch] = useReducer(reviewReducer, []);
  rows = state;
  dispatchRows = dispatch;
  run = useReviewRun({ settings: SETTINGS, dispatchRows: dispatch, extract });
  return null;
}

/** An extract whose calls resolve or fail when the test says so. */
function controlled() {
  const calls: Array<{
    input: ExtractBoothInput;
    tier: string;
    fresh: boolean | undefined;
    resolve: (value: ExtractionResult) => void;
    reject: (error: unknown) => void;
  }> = [];
  const extract: ExtractFn = (input, options) =>
    new Promise((resolve, reject) => {
      calls.push({ input, tier: options.settings.tier, fresh: options.bypassCacheRead, resolve, reject });
    });
  return { calls, extract };
}

afterEach(() => cleanup());

describe('useReviewRun', () => {
  it("retries on the last run's tier and re-runs the same tier without the cache", async () => {
    const { calls, extract } = controlled();
    render(<Probe extract={extract} />);
    act(() => run.start(INPUT));
    await act(async () => calls[0]?.resolve(result([])));
    // "Accurate mode": another tier may use the cache.
    act(() => run.runAgain(INPUT, 'accurate'));
    await act(async () => calls[1]?.resolve(result([])));
    // "Analyze again" stays on accurate and reads no cache.
    act(() => run.runAgain(INPUT));
    await act(async () => calls[2]?.reject(new AIError('network', 'offline', 'openai')));
    expect(run.state.status).toBe('error');
    // Retry keeps accurate; calls that already finished may come from the cache.
    act(() => run.retry(INPUT));
    expect(calls.map((c) => [c.tier, c.fresh])).toEqual([
      ['fast', undefined],
      ['accurate', undefined],
      ['accurate', true],
      ['accurate', undefined],
    ]);
  });

  it("keeps the rows and the user's edits through a re-run that finds them again", async () => {
    const { calls, extract } = controlled();
    render(<Probe extract={extract} />);
    act(() => run.start(INPUT));
    await act(async () =>
      calls[0]?.resolve(result([item('Keyring', 5000), item('Sticker', 1500), item('Poster', 3000)]))
    );
    act(() => dispatchRows({ type: 'edit', key: 't:keyring|5000', patch: { quantity: 3, name: 'My keyring' } }));
    act(() => dispatchRows({ type: 'toggle', key: 't:sticker|1500' }));

    act(() => run.runAgain(INPUT));
    // Nothing disappears while the new run is under way.
    expect(rows.map((r) => r.key)).toEqual(['t:keyring|5000', 't:sticker|1500', 't:poster|3000']);
    act(() => calls[1]?.input.onPartial?.({ items: [item('Keyring', 5000)], currency: 'KRW' }, { index: 0, imageIndex: null }));
    expect(rows).toHaveLength(3);

    // The new result no longer has the poster, which the user never touched.
    await act(async () => calls[1]?.resolve(result([item('Keyring', 5000), item('Sticker', 1500)])));
    expect(rows.map((r) => [r.key, r.name, r.quantity, r.included])).toEqual([
      ['t:keyring|5000', 'My keyring', 3, true],
      ['t:sticker|1500', undefined, 1, false],
    ]);
  });

  it('maps skipped image indices of the finished run to their URLs', async () => {
    const { calls, extract } = controlled();
    render(<Probe extract={extract} />);
    act(() => run.start({ text: '', images: ['a.jpg', 'b.jpg', 'c.jpg'] }));
    expect(run.skippedUrls.size).toBe(0);
    await act(async () => calls[0]?.resolve(result([], { skippedImages: [0, 2] })));
    expect([...run.skippedUrls]).toEqual(['a.jpg', 'c.jpg']);
  });
});
