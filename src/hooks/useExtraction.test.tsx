// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@/components/ui/test-utils';
import type { ExtractBoothInput } from '@/lib/ai/engine';
import {
  AIError,
  type ExtractedItem,
  type ExtractionResult,
} from '@/lib/ai/types';
import { createDefaultSettings } from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import {
  assembleRows,
  CLI_MAX_IMAGES,
  extractionReducer,
  INITIAL_EXTRACTION_STATE,
  runExtractionCalls,
  summarizeResults,
  useExtraction,
  type ExtractFn,
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
  calls: 2,
  imageCount: 2,
  tier: 'fast' as const,
  provider: 'openai' as const,
  model: 'gpt-6-luna',
};

describe('assembleRows', () => {
  it('keeps call order, tags currencies and dedupes repeats across images', () => {
    const rows = assembleRows(
      [[item('Keyring'), item('Sticker', 500)], [item('keyring'), item('Badge', 400)]],
      ['KRW', 'KRW']
    );
    expect(rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:keyring|1000', 'KRW'],
      ['0:sticker|500', 'KRW'],
      ['1:badge|400', 'KRW'],
    ]);
  });

  it('keeps same-named items priced in different currencies', () => {
    const rows = assembleRows([[item('Book', 800)], [item('Book', 800)]], ['KRW', 'JPY']);
    expect(rows.map((r) => r.currency)).toEqual(['KRW', 'JPY']);
  });
});

describe('summarizeResults', () => {
  it('takes booth fields from the first call that has them', () => {
    const outcome = summarizeResults([
      result([], { booth: { ...result([]).booth, boothNumber: 'B-12' }, currency: null }),
      result([], {
        booth: { ...result([]).booth, boothNumber: 'X', circleName: 'Moon', isMailOrder: true },
        currency: 'JPY',
      }),
    ]);
    expect(outcome?.booth).toMatchObject({
      boothNumber: 'B-12',
      circleName: 'Moon',
      isMailOrder: true,
    });
    expect(outcome?.currency).toBe('JPY');
  });

  it('reports skipped images and aggregate meta', () => {
    const outcome = summarizeResults([
      result([], {}, { skippedImages: [0], cached: true, latencyMs: 40 }),
      null,
      result([], {}, { cached: true, latencyMs: 90 }),
    ]);
    expect(outcome?.meta).toMatchObject({
      skippedImages: [0, 1],
      cached: true,
      latencyMs: 90,
    });
    expect(summarizeResults([null])).toBeNull();
  });
});

describe('extractionReducer', () => {
  it('moves preparing -> streaming -> done', () => {
    let state = extractionReducer(INITIAL_EXTRACTION_STATE, START);
    expect(state.status).toBe('preparing');
    expect(state.partial).toEqual([[], []]);

    state = extractionReducer(state, {
      type: 'partial',
      runId: 1,
      call: 1,
      items: [item('Badge', 400)],
    });
    expect(state.status).toBe('streaming');
    expect(state.rows.map((r) => r.key)).toEqual(['1:badge|400']);

    state = extractionReducer(state, {
      type: 'done',
      runId: 1,
      at: 4000,
      results: [
        result([item('Keyring')], { currency: 'KRW' }),
        result([item('Badge', 400)], { currency: 'JPY' }),
      ],
    });
    expect(state.status).toBe('done');
    expect(state.finishedAt).toBe(4000);
    expect(state.rows.map((r) => [r.key, r.currency])).toEqual([
      ['0:keyring|1000', 'KRW'],
      ['1:badge|400', 'JPY'],
    ]);
    expect(state.outcome?.currency).toBe('KRW');
  });

  it('ignores events from superseded runs and after completion', () => {
    const running = extractionReducer(INITIAL_EXTRACTION_STATE, { ...START, runId: 2 });
    const stale = extractionReducer(running, {
      type: 'partial',
      runId: 1,
      call: 0,
      items: [item('Old')],
    });
    expect(stale).toBe(running);
    const failed = extractionReducer(running, {
      type: 'fail',
      runId: 2,
      at: 5,
      error: new AIError('auth', 'x', 'openai'),
    });
    expect(failed.status).toBe('error');
    expect(
      extractionReducer(failed, { type: 'done', runId: 2, at: 6, results: [null] })
    ).toBe(failed);
  });

  it('treats a cancellation as cancelled, not as an error', () => {
    const running = extractionReducer(INITIAL_EXTRACTION_STATE, START);
    const state = extractionReducer(running, {
      type: 'fail',
      runId: 1,
      at: 2,
      error: new AIError('cancelled', 'x'),
    });
    expect(state.status).toBe('cancelled');
    expect(state.error).toBeNull();
  });
});

describe('runExtractionCalls', () => {
  it('runs one call per image with the text on the first', async () => {
    const calls: ExtractBoothInput[] = [];
    const extract: ExtractFn = async (input) => {
      calls.push(input);
      return result([item(`from ${String(input.images[0])}`)]);
    };
    const results = await runExtractionCalls({
      input: { text: 'post', images: ['a.jpg', 'b.jpg'], hints: { defaultCurrency: 'KRW' } },
      settings: settings(),
      tier: 'accurate',
      signal: new AbortController().signal,
      extract,
      onPartial: () => {},
    });
    expect(results).toHaveLength(2);
    expect(calls.map((c) => [c.text, c.images])).toEqual([
      ['post', ['a.jpg']],
      ['', ['b.jpg']],
    ]);
    expect(calls[0]?.hints).toEqual({ defaultCurrency: 'KRW' });
  });

  it('passes the tier override to the engine settings', async () => {
    const tiers: string[] = [];
    const extract: ExtractFn = async (_input, options) => {
      tiers.push(options.settings.tier);
      return result([]);
    };
    await runExtractionCalls({
      input: { text: 'post', images: [] },
      settings: settings(),
      tier: 'accurate',
      signal: new AbortController().signal,
      extract,
      onPartial: () => {},
    });
    expect(tiers).toEqual(['accurate']);
  });

  it('limits the local CLI to six images', async () => {
    const extract = vi.fn<ExtractFn>(async () => result([]));
    await runExtractionCalls({
      input: { text: '', images: Array.from({ length: 9 }, (_, i) => `${i}.jpg`) },
      settings: settings('cli'),
      tier: 'fast',
      signal: new AbortController().signal,
      extract,
      onPartial: () => {},
    });
    expect(extract).toHaveBeenCalledTimes(CLI_MAX_IMAGES);
  });

  it('skips a later image that cannot be loaded', async () => {
    const extract: ExtractFn = async (input) => {
      if (input.images[0] === 'broken.jpg') {
        throw new AIError('network', 'Image download failed (HTTP 404)');
      }
      return result([item('ok')]);
    };
    const results = await runExtractionCalls({
      input: { text: 'post', images: ['a.jpg', 'broken.jpg'] },
      settings: settings(),
      tier: 'fast',
      signal: new AbortController().signal,
      extract,
      onPartial: () => {},
    });
    expect(results[1]).toBeNull();
  });

  it('aborts the other calls when one fails', async () => {
    const signals: AbortSignal[] = [];
    const extract: ExtractFn = (input) => {
      signals.push(input.signal!);
      if (input.images[0] === 'a.jpg') {
        return Promise.reject(new AIError('auth', 'bad key', 'openai'));
      }
      return new Promise((_, reject) =>
        input.signal!.addEventListener('abort', () =>
          reject(new AIError('cancelled', 'x', 'openai'))
        )
      );
    };
    await expect(
      runExtractionCalls({
        input: { text: '', images: ['a.jpg', 'b.jpg'] },
        settings: settings(),
        tier: 'fast',
        signal: new AbortController().signal,
        extract,
        onPartial: () => {},
      })
    ).rejects.toMatchObject({ code: 'auth' });
    expect(signals.every((s) => s.aborted)).toBe(true);
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

  it('streams partial items and finishes', async () => {
    let finish: (value: ExtractionResult) => void = () => {};
    let partial: ExtractBoothInput['onPartial'];
    const extract: ExtractFn = (input) => {
      partial = input.onPartial;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'post', images: ['a.jpg'] }));
    expect(api.state.status).toBe('preparing');
    expect(api.state.model).toBe('gpt-6-luna');

    act(() => partial?.({ items: [item('Keyring')] }));
    expect(api.state.status).toBe('streaming');
    expect(api.state.rows).toHaveLength(1);

    await act(async () => finish(result([item('Keyring'), item('Sticker', 500)])));
    expect(api.state.status).toBe('done');
    expect(api.state.rows).toHaveLength(2);
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

  it('cancels, and retries on the accurate tier', async () => {
    const tiers: string[] = [];
    const extract: ExtractFn = (input, options) => {
      tiers.push(options.settings.tier);
      return new Promise((_, reject) =>
        input.signal!.addEventListener('abort', () =>
          reject(new AIError('cancelled', 'x', 'openai'))
        )
      );
    };
    render(<Probe settings={settings()} extract={extract} />);
    act(() => api.start({ text: 'post', images: [] }));
    await act(async () => api.cancel());
    expect(api.state.status).toBe('cancelled');

    act(() => api.retry({ tier: 'accurate' }));
    expect(api.state.status).toBe('preparing');
    expect(api.state.tier).toBe('accurate');
    expect(tiers).toEqual(['fast', 'accurate']);
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
});
