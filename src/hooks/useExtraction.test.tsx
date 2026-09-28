// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewReducer, toItemRecords, type ReviewRow } from '@/components/analysis/items-review-state';
import { cleanup, render } from '@/components/ui/test-utils';
import { extractBooth, type ExtractBoothInput } from '@/lib/ai/engine';
import type { DecodedImage, ImageCodec } from '@/lib/ai/image';
import { MODEL_TABLE } from '@/lib/ai/models';
import { getProvider, registerProvider } from '@/lib/ai/providers';
import {
  AIError,
  type ExtractedItem,
  type ExtractionResult,
  type WireExtraction,
} from '@/lib/ai/types';
import { createDefaultSettings } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import {
  assembleRows,
  CLI_MAX_IMAGES,
  extractionReducer,
  INITIAL_EXTRACTION_STATE,
  useExtraction,
  type CallRows,
  type ExtractFn,
  type ExtractionAction,
  type ExtractionState,
  type UseExtraction,
} from './useExtraction';

vi.mock('@/lib/ai/runtime', () => ({
  ensureAIRuntime: vi.fn(),
  setRuntimeAISettings: vi.fn(),
  getAnalysisCache: () => undefined,
}));

function item(name: string, price: number | null = 1000): ExtractedItem {
  return { name, originalName: null, price, category: 'other', options: [] };
}

function result(
  items: ExtractedItem[],
  patch: Partial<ExtractionResult> = {},
  meta: Partial<ExtractionResult['meta']> = {}
): ExtractionResult {
  return {
    booth: {
      boothNumber: null,
      circleName: null,
      eventName: null,
      zone: null,
      isMailOrder: false,
    },
    currency: 'KRW',
    items,
    meta: {
      provider: 'openai',
      model: 'gpt-6-luna',
      latencyMs: 100,
      cached: false,
      ...meta,
    },
    ...patch,
  };
}

function settings(provider: AppSettings['ai']['provider'] = 'openai'): AppSettings {
  const base = createDefaultSettings();
  return {
    ...base,
    ai: { ...base.ai, provider, openai: { apiKey: 'test-key', model: null } },
  };
}

const START = {
  type: 'start' as const,
  runId: 1,
  at: 1000,
  images: ['a.jpg', 'b.jpg'],
  tier: 'fast' as const,
  provider: 'openai' as const,
  model: 'gpt-6-luna',
};

function calls(...lists: Array<[number | null, ExtractedItem[], string | null | undefined]>): CallRows[] {
  return lists.map(([imageIndex, items, currency]) => ({ imageIndex, items, currency }));
}

const NO_KEYS = INITIAL_EXTRACTION_STATE.keys;

function partial(
  call: number,
  items: ExtractedItem[],
  currency?: string | null,
  runId = 1
): ExtractionAction {
  return { type: 'partial', runId, call, imageIndex: call, items, currency };
}

function reduce(state: ExtractionState, ...actions: ExtractionAction[]): ExtractionState {
  return actions.reduce(extractionReducer, state);
}

describe('assembleRows', () => {
  it("keeps call order, tags each call's currency and collapses an item repeated on another image", () => {
    const { rows } = assembleRows(
      calls(
        [0, [item('Keyring'), item('Sticker', 500)], 'KRW'],
        [1, [item('keyring'), item('Badge', 400)], 'KRW']
      ),
      NO_KEYS
    );
    expect(rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:keyring|1000', 'KRW'],
      ['0:sticker|500', 'KRW'],
      ['1:badge|400', 'KRW'],
    ]);
  });

  it('keeps same-named items priced in different currencies, or in a currency not known yet', () => {
    const differ = assembleRows(calls([0, [item('Book', 800)], 'KRW'], [1, [item('Book', 800)], 'JPY']), NO_KEYS);
    expect(differ.rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:book|800', 'KRW'],
      ['1:book|800', 'JPY'],
    ]);
    const unknown = assembleRows(calls([0, [item('Book', 800)], 'KRW'], [1, [item('Book', 800)], undefined]), NO_KEYS);
    expect(unknown.rows).toHaveLength(2);
  });

  it('keys a text-only call with t', () => {
    const { rows } = assembleRows(calls([null, [item('Tape', 90)], 'TWD']), NO_KEYS);
    expect(rows[0]?.key).toBe('t:tape|90');
  });
});

describe('extractionReducer', () => {
  it('moves preparing -> streaming -> done with per-call currencies', () => {
    let state = reduce(INITIAL_EXTRACTION_STATE, START);
    expect(state.status).toBe('preparing');
    expect(state.images).toEqual(['a.jpg', 'b.jpg']);

    state = reduce(state, partial(1, [], 'JPY'), partial(1, [item('Badge', 400)]));
    expect(state.status).toBe('streaming');
    // The currency reported first stays on later updates without one.
    expect(state.rows.map((r) => [r.key, r.currency])).toEqual([['1:badge|400', 'JPY']]);

    state = reduce(state, {
      type: 'done',
      runId: 1,
      at: 4000,
      result: result([item('Keyring'), item('Badge', 400)], {
        currency: 'KRW',
        calls: [
          { imageIndex: 0, currency: 'KRW', items: [item('Keyring')] },
          { imageIndex: 1, currency: 'JPY', items: [item('Badge', 400)] },
        ],
      }),
    });
    expect(state.status).toBe('done');
    expect(state.finishedAt).toBe(4000);
    expect(state.rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:keyring|1000', 'KRW'],
      ['1:badge|400', 'JPY'],
    ]);
    expect(state.outcome?.currency).toBe('KRW');
  });

  it('gives an item the same key while streaming and when done', () => {
    let state = reduce(
      INITIAL_EXTRACTION_STATE,
      START,
      partial(0, [item('Keyring'), item('Book', 800)], 'KRW'),
      partial(1, [item('Book', 800), item('Postcard', 300)], 'JPY')
    );
    const streamed = state.rows.map((r) => [r.key, r.currency]);
    state = reduce(state, {
      type: 'done',
      runId: 1,
      at: 2,
      result: result([], {
        calls: [
          { imageIndex: 0, currency: 'KRW', items: [item('Keyring'), item('Book', 800)] },
          { imageIndex: 1, currency: 'JPY', items: [item('Book', 800), item('Postcard', 300)] },
        ],
      }),
    });
    expect(state.rows.map((r) => [r.key, r.currency])).toEqual(streamed);
  });

  it('keeps one row, under its first key, when an earlier call streams the same item later', () => {
    // Call 1 streams "Badge 500" first and the user edits that row.
    let state = reduce(INITIAL_EXTRACTION_STATE, START, partial(1, [item('Badge', 500)], 'KRW'));
    let review: ReviewRow[] = reviewReducer([], { type: 'sync', rows: state.rows, prune: false });
    review = reviewReducer(review, { type: 'edit', key: '1:badge|500', patch: { quantity: 3 } });

    // Call 0 then reports the same item.
    state = reduce(state, partial(0, [item('Badge', 500)], 'KRW'));
    expect(state.rows.map((r) => r.key)).toEqual(['1:badge|500']);
    review = reviewReducer(review, { type: 'sync', rows: state.rows, prune: false });

    state = reduce(state, {
      type: 'done',
      runId: 1,
      at: 3,
      result: result([item('Badge', 500)], {
        calls: [
          { imageIndex: 0, currency: 'KRW', items: [item('Badge', 500)] },
          { imageIndex: 1, currency: 'KRW', items: [item('Badge', 500)] },
        ],
      }),
    });
    review = reviewReducer(review, { type: 'sync', rows: state.rows });
    expect(review.map((r) => [r.key, r.quantity])).toEqual([['1:badge|500', 3]]);
    const saved = toItemRecords(review, { boothId: 'b', eventCurrency: 'KRW', badgeId: 'x', now: 1 });
    expect(saved).toHaveLength(1);
  });

  it('reuses the row keys of an earlier run', () => {
    let state = reduce(INITIAL_EXTRACTION_STATE, START, partial(1, [item('Badge', 500)], 'KRW'), partial(0, [item('Badge', 500)], 'KRW'));
    state = reduce(state, { ...START, runId: 2 });
    expect(state.rows).toEqual([]);
    state = reduce(state, partial(0, [item('Badge', 500)], 'KRW', 2));
    expect(state.rows.map((r) => r.key)).toEqual(['1:badge|500']);
  });

  it('ignores events from superseded runs and after completion', () => {
    const running = reduce(INITIAL_EXTRACTION_STATE, { ...START, runId: 2 });
    expect(reduce(running, partial(0, [item('Old')], 'KRW', 1))).toBe(running);
    const failed = reduce(running, {
      type: 'fail',
      runId: 2,
      at: 5,
      error: new AIError('auth', 'x', 'openai'),
    });
    expect(failed.status).toBe('error');
    expect(reduce(failed, { type: 'done', runId: 2, at: 6, result: result([]) })).toBe(failed);
  });

  it('leaves a currency that never arrived unknown when the run fails', () => {
    let state = reduce(INITIAL_EXTRACTION_STATE, START, partial(0, [item('Keyring')]));
    expect(state.rows[0]?.currency).toBeUndefined();
    state = reduce(state, { type: 'fail', runId: 1, at: 9, error: new AIError('network', 'x', 'openai') });
    expect(state.status).toBe('error');
    expect(state.rows[0]?.currency).toBeUndefined();
  });

  it('treats a cancellation as cancelled, not as an error', () => {
    const state = reduce(INITIAL_EXTRACTION_STATE, START, {
      type: 'fail',
      runId: 1,
      at: 2,
      error: new AIError('cancelled', 'x'),
    });
    expect(state.status).toBe('cancelled');
    expect(state.error).toBeNull();
  });

  it('reads a result without per-call lists as one call', () => {
    const state = reduce(INITIAL_EXTRACTION_STATE, START, {
      type: 'done',
      runId: 1,
      at: 2,
      result: result([item('Tape', 90)], { currency: 'TWD' }),
    });
    expect(state.rows.map((r) => [r.key, r.currency])).toEqual([['t:tape|90', 'TWD']]);
  });
});

describe('useExtraction', () => {
  let api: UseExtraction;

  function Probe(props: { settings: AppSettings | null; extract: ExtractFn }) {
    api = useExtraction(props);
    return null;
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => cleanup());

  it('makes one engine call and streams per-call items', async () => {
    let finish: (value: ExtractionResult) => void = () => {};
    const inputs: ExtractBoothInput[] = [];
    const extract: ExtractFn = (input) => {
      inputs.push(input);
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'post', images: ['a.jpg', 'b.jpg'], hints: { defaultCurrency: 'KRW' } }));
    expect(api.state.status).toBe('preparing');
    expect(api.state.model).toBe('gpt-6-luna');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ text: 'post', images: ['a.jpg', 'b.jpg'], hints: { defaultCurrency: 'KRW' } });

    act(() => inputs[0]?.onPartial?.({ items: [item('Book', 800)], currency: 'JPY' }, { index: 1, imageIndex: 1 }));
    expect(api.state.status).toBe('streaming');
    expect(api.state.rows.map((r) => [r.key, r.currency])).toEqual([['1:book|800', 'JPY']]);

    await act(async () =>
      finish(
        result([item('Keyring'), item('Book', 800)], {
          calls: [
            { imageIndex: 0, currency: 'KRW', items: [item('Keyring')] },
            { imageIndex: 1, currency: 'JPY', items: [item('Book', 800)] },
          ],
        })
      )
    );
    expect(api.state.status).toBe('done');
    expect(api.state.rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:keyring|1000', 'KRW'],
      ['1:book|800', 'JPY'],
    ]);
  });

  it('passes the tier and a fresh re-analysis to the engine', async () => {
    const seen: Array<[string, boolean | undefined]> = [];
    const extract: ExtractFn = async (_input, options) => {
      seen.push([options.settings.tier, options.bypassCacheRead]);
      return result([]);
    };
    render(<Probe settings={settings()} extract={extract} />);
    await act(async () => api.start({ text: 'post', images: [] }));
    await act(async () => api.start({ text: 'post', images: [] }, { tier: 'accurate', fresh: true }));
    expect(seen).toEqual([
      ['fast', undefined],
      ['accurate', true],
    ]);
    expect(api.state.tier).toBe('accurate');
  });

  it('limits the local CLI to six images', async () => {
    const extract = vi.fn<ExtractFn>(async () => result([]));
    render(<Probe settings={settings('cli')} extract={extract} />);
    await act(async () =>
      api.start({ text: '', images: Array.from({ length: 9 }, (_, i) => `${i}.jpg`) })
    );
    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract.mock.calls[0]?.[0].images).toHaveLength(CLI_MAX_IMAGES);
  });

  it('fails with not_configured without a provider, and with nothing to analyze', () => {
    const extract = vi.fn<ExtractFn>();
    render(<Probe settings={settings(null)} extract={extract} />);
    act(() => api.start({ text: 'post', images: [] }));
    expect(api.state.status).toBe('error');
    expect(api.state.error?.code).toBe('not_configured');

    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: '  ', images: [] }));
    expect(api.state.error?.code).toBe('unknown');
    expect(extract).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    const extract: ExtractFn = (input) =>
      new Promise((_, reject) =>
        input.signal!.addEventListener('abort', () => reject(new AIError('cancelled', 'x', 'openai')))
      );
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'post', images: [] }));
    await act(async () => api.cancel());
    expect(api.state.status).toBe('cancelled');
  });

  it('drops the result of a run that was superseded', async () => {
    const resolvers: Array<(value: ExtractionResult) => void> = [];
    const extract: ExtractFn = () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      });
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'first', images: [] }));
    act(() => api.start({ text: 'second', images: [] }));
    await act(async () => resolvers[0]?.(result([item('Stale')])));
    expect(api.state.status).toBe('preparing');
    await act(async () => resolvers[1]?.(result([item('Fresh')])));
    expect(api.state.rows.map((r) => r.item.name)).toEqual(['Fresh']);
  });

  it('aborts the run when unmounted', () => {
    let signal: AbortSignal | undefined;
    const extract: ExtractFn = (input) => {
      signal = input.signal;
      return new Promise(() => {});
    };
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'post', images: [] }));
    cleanup();
    expect(signal?.aborted).toBe(true);
  });

  describe('with the real engine', () => {
    const builtin = getProvider('openai');
    const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const codec: ImageCodec<DecodedImage> = {
      decode: async (blob) => ({ width: 100, height: blob.size, close: () => undefined }),
      encodeJpeg: async (_image, width, height) => new Blob([JPEG, new Uint8Array([width % 256, height % 256])]),
    };
    const wire = (name: string, price: number): WireExtraction => ({
      booth: { number: null, circle: null, event: null, zone: null, mailOrder: false },
      currency: 'JPY',
      items: [{ name, orig: null, price, cat: 'other', opts: [] }],
    });

    afterEach(() => {
      registerProvider(builtin);
      vi.unstubAllGlobals();
    });

    it('skips a first image that cannot be loaded when there is no post text', async () => {
      let n = 0;
      registerProvider({
        id: 'openai',
        defaultModel: (tier) => MODEL_TABLE.openai[tier],
        extract: async () => {
          n += 1;
          return { wire: wire(`Item ${n}`, 100 * n), model: 'm' };
        },
        testConnection: async () => undefined,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.includes('expired')
            ? new Response('gone', { status: 404 })
            : new Response(new Blob([JPEG, new Uint8Array(url.length)]), { status: 200 })
        )
      );
      let pending: Promise<unknown> = Promise.resolve();
      const extract: ExtractFn = (input, options) => {
        const run = extractBooth(input, { ...options, codec });
        pending = run.catch(() => undefined);
        return run;
      };
      render(<Probe settings={settings()} extract={extract} />);
      await act(async () => {
        api.start({
          text: '',
          images: ['https://x.test/expired.jpg', 'https://x.test/b.jpg', 'https://x.test/c.jpg', 'https://x.test/d.jpg'],
        });
        await pending;
      });
      expect(api.state.status).toBe('done');
      expect(api.state.outcome?.meta.skippedImages).toEqual([0]);
      expect(api.state.rows).toHaveLength(3);
      expect(api.state.rows.every((row) => row.currency === 'JPY')).toBe(true);
      expect(api.state.rows.map((row) => row.key.split(':')[0])).toEqual(['1', '2', '3']);
    });
  });
});
