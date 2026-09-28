import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS, type AISettings } from '@/lib/settings-types';
import { createMemoryCacheStore, type AnalysisCacheStore, type CachedAnalysis } from './cache';
import {
  CALL_TIMEOUTS,
  extractBooth,
  resolveTarget,
  type ExtractBoothInput,
  type ExtractBoothOptions,
} from './engine';
import type { DecodedImage, ImageCodec } from './image';
import { MODEL_TABLE } from './models';
import { getProvider, registerProvider } from './providers';
import type { WireItem } from './schema';
import {
  AIError,
  type AIProvider,
  type ExtractionRequest,
  type PartialExtraction,
  type ProviderCallOptions,
  type ProviderRawResult,
  type WireExtraction,
} from './types';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/** Every blob decodes to 1000 px wide and (size * 100) px tall, so images differ. */
const codec: ImageCodec<DecodedImage> = {
  decode: async (blob) => ({ width: 1000, height: blob.size * 100, close: () => undefined }),
  encodeJpeg: vi.fn(async (_image, width, height) => new Blob([JPEG, new Uint8Array([width % 256, height % 256])])),
};

function image(extraBytes = 0): Blob {
  return new Blob([JPEG, new Uint8Array(extraBytes)]);
}

const item = (name: string, price: number | null, opts: string[] = []): WireItem => ({
  name,
  orig: null,
  price,
  cat: 'other',
  opts,
});

function wire(over: Partial<WireExtraction> = {}): WireExtraction {
  return {
    booth: { number: null, circle: null, event: null, zone: null, mailOrder: false },
    currency: null,
    items: [],
    ...over,
  };
}

type Handler = (req: ExtractionRequest, opts: ProviderCallOptions, call: number) => Promise<ProviderRawResult>;

interface FakeProvider extends AIProvider {
  calls: Array<{ req: ExtractionRequest; opts: ProviderCallOptions }>;
}

function fakeProvider(handler: Handler): FakeProvider {
  const calls: FakeProvider['calls'] = [];
  return {
    id: 'openai',
    calls,
    defaultModel: (tier) => MODEL_TABLE.openai[tier],
    extract: (req, opts) => {
      calls.push({ req, opts });
      return handler(req, opts, calls.length - 1);
    },
    testConnection: async () => undefined,
  };
}

const ok = (w: WireExtraction, extra: Partial<ProviderRawResult> = {}): ProviderRawResult => ({
  wire: w,
  model: 'served-model',
  ...extra,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch() stub: 404 for URLs containing "missing", never settles (until aborted) for "stalled". */
function stubImageFetch() {
  const signals: AbortSignal[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    if (init.signal) signals.push(init.signal);
    if (url.includes('missing')) return Promise.resolve(new Response('gone', { status: 404 }));
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, signals };
}

/** Resolves when the call's signal aborts, rejecting like a provider would. */
function untilAborted(opts: ProviderCallOptions): Promise<never> {
  return new Promise((_resolve, reject) => {
    opts.signal?.addEventListener('abort', () => reject(opts.signal?.reason), { once: true });
  });
}

const SETTINGS: AISettings = {
  ...DEFAULT_AI_SETTINGS,
  provider: 'openai',
  openai: { apiKey: ' sk-test ', model: null },
};

function input(over: Partial<ExtractBoothInput> = {}): ExtractBoothInput {
  return { text: 'Booth A-01 price list', images: [], targetLanguage: 'ko', ...over };
}

function options(over: Partial<ExtractBoothOptions> = {}): ExtractBoothOptions {
  return { settings: SETTINGS, codec, retryDelayMs: 0, ...over };
}

const builtinOpenAI = getProvider('openai');
let provider: FakeProvider;

function useProvider(handler: Handler): FakeProvider {
  provider = fakeProvider(handler);
  registerProvider(provider);
  return provider;
}

beforeEach(() => {
  useProvider(async () => ok(wire()));
});

afterEach(() => {
  registerProvider(builtinOpenAI);
  vi.unstubAllGlobals();
});

describe('resolveTarget', () => {
  it('requires a provider and a key', () => {
    expect(() => resolveTarget(DEFAULT_AI_SETTINGS)).toThrowError(
      expect.objectContaining({ code: 'not_configured' })
    );
    expect(() =>
      resolveTarget({ ...SETTINGS, provider: 'anthropic', anthropic: { apiKey: '  ', model: null } })
    ).toThrowError(expect.objectContaining({ code: 'not_configured', provider: 'anthropic' }));
  });

  it('uses the tier default unless a model is chosen, and trims the key', () => {
    expect(resolveTarget(SETTINGS)).toMatchObject({ model: MODEL_TABLE.openai.fast, apiKey: 'sk-test' });
    expect(resolveTarget({ ...SETTINGS, tier: 'accurate' }).model).toBe(MODEL_TABLE.openai.accurate);
    expect(
      resolveTarget({ ...SETTINGS, openai: { apiKey: 'k', model: 'custom-model' } }).model
    ).toBe('custom-model');
  });

  it('reports the CLI bridge as not configured until ACORN-6 registers it', () => {
    expect(() => resolveTarget({ ...SETTINGS, provider: 'cli' })).toThrowError(
      expect.objectContaining({ code: 'not_configured', provider: 'cli' })
    );
  });
});

describe('extractBooth', () => {
  it('makes one text-only call when there are no images', async () => {
    useProvider(async () =>
      ok(wire({ currency: 'KRW', items: [item('Tape', 4000)] }), { inputTokens: 10, outputTokens: 5 })
    );
    const result = await extractBooth(input({ hints: { defaultCurrency: 'KRW' } }), options());
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.req).toMatchObject({
      text: 'Booth A-01 price list',
      images: [],
      targetLanguage: 'ko',
      tier: 'fast',
      hints: { defaultCurrency: 'KRW' },
    });
    expect(provider.calls[0]?.opts).toMatchObject({ apiKey: 'sk-test', model: MODEL_TABLE.openai.fast });
    expect(result).toMatchObject({
      currency: 'KRW',
      items: [{ name: 'Tape', price: 4000, category: 'other', options: [], originalName: null }],
      meta: { provider: 'openai', model: 'served-model', cached: false, inputTokens: 10, outputTokens: 5 },
    });
  });

  it('fans out one parallel call per image; only the first carries the text', async () => {
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    useProvider(async (_req, _opts, call) => {
      started++;
      if (started === 3) release();
      await gate;
      return ok(
        [
          wire({ booth: { number: 'A-01', circle: null, event: 'SCW', zone: null, mailOrder: false }, currency: 'KRW', items: [item('Keyring', 5000, ['A'])] }),
          wire({ booth: { number: 'Z-99', circle: 'Moon', event: null, zone: null, mailOrder: true }, currency: 'JPY', items: [item('keyring', 5000, ['B']), item('Sticker', 1500)] }),
          wire({ currency: 'JPY', items: [item('Postcard', 2000)] }),
        ][call] ?? wire(),
        { inputTokens: 100, outputTokens: 10 * (call + 1), model: `served-${call}` }
      );
    });

    const result = await extractBooth(input({ images: [image(1), image(2), image(3)] }), options());
    expect(started).toBe(3);
    expect(provider.calls.map((c) => c.req.text)).toEqual(['Booth A-01 price list', '', '']);
    expect(provider.calls.map((c) => c.req.images.length)).toEqual([1, 1, 1]);
    expect(new Set(provider.calls.map((c) => c.req.images[0]?.hash)).size).toBe(3);
    expect(result.booth).toEqual({
      boothNumber: 'A-01',
      circleName: 'Moon',
      eventName: 'SCW',
      zone: null,
      isMailOrder: true,
    });
    // The text-bearing first call's currency wins over the image-only majority.
    expect(result.currency).toBe('KRW');
    expect(result.items.map((i) => [i.name, i.options])).toEqual([
      ['Keyring', ['A', 'B']],
      ['Sticker', []],
      ['Postcard', []],
    ]);
    expect(result.meta).toMatchObject({ model: 'served-0', inputTokens: 300, outputTokens: 60 });
  });

  it('prepares images with the model limits', async () => {
    vi.mocked(codec.encodeJpeg).mockClear();
    await extractBooth(input({ images: [image(40)] }), options());
    // 1000 x 4800 -> long edge 2048 for GPT-6.
    expect(codec.encodeJpeg).toHaveBeenCalledWith(expect.anything(), 426, 2048, 0.9);
    expect(provider.calls[0]?.req.images[0]).toMatchObject({ width: 426, height: 2048, mimeType: 'image/jpeg' });
  });

  it('measures latency with the injected clock', async () => {
    let t = 1000;
    const result = await extractBooth(input(), options({ now: () => (t += 250) }));
    expect(result.meta.latencyMs).toBe(250);
  });

  describe('cache', () => {
    it('serves repeats from the cache without calling the provider', async () => {
      const cache = createMemoryCacheStore();
      useProvider(async () => ok(wire({ items: [item('Tape', 4000)] })));
      const first = await extractBooth(input({ images: [image()] }), options({ cache }));
      const second = await extractBooth(input({ images: [image()] }), options({ cache }));
      expect(provider.calls).toHaveLength(1);
      expect(first.meta.cached).toBe(false);
      expect(second.meta.cached).toBe(true);
      expect(second.items).toEqual(first.items);
    });

    it('misses when the language, hints, tier, model or image change', async () => {
      const cache = createMemoryCacheStore();
      await extractBooth(input(), options({ cache }));
      await extractBooth(input({ targetLanguage: 'ja' }), options({ cache }));
      await extractBooth(input({ hints: { eventNames: ['SCW'] } }), options({ cache }));
      await extractBooth(input(), options({ cache, settings: { ...SETTINGS, tier: 'accurate' } }));
      await extractBooth(input({ images: [image()] }), options({ cache }));
      expect(provider.calls).toHaveLength(5);
    });

    it('treats cached entries that fail validation as a miss and replaces them', async () => {
      const entries = new Map<string, unknown>();
      const store: AnalysisCacheStore = {
        get: async (key) => entries.get(key) as CachedAnalysis | undefined,
        set: async (key, value) => {
          entries.set(key, value);
        },
      };
      useProvider(async () => ok(wire({ currency: 'KRW', items: [item('Tape', 4000)] })));
      await extractBooth(input(), options({ cache: store }));
      const [key] = [...entries.keys()];
      const good = entries.get(key ?? '') as CachedAnalysis;
      const corrupt: unknown[] = [
        null,
        'stale',
        { result: null },
        { result: { ...good.result, items: 'Tape' } },
        { result: { ...good.result, booth: null } },
        { result: { ...good.result, meta: { ...good.result.meta, model: 7 } } },
        { result: { ...good.result, items: [{ name: '', price: 1 }] } },
        { result: { ...good.result, items: [...good.result.items, 'garbage'] } },
      ];
      for (const entry of corrupt) {
        entries.set(key ?? '', entry);
        expect((await extractBooth(input(), options({ cache: store }))).meta.cached).toBe(false);
      }
      expect(provider.calls).toHaveLength(1 + corrupt.length);

      const hit = await extractBooth(input(), options({ cache: store }));
      expect(hit.meta.cached).toBe(true);
      expect(hit).toMatchObject({ currency: 'KRW', items: [{ name: 'Tape', price: 4000 }] });
      expect(provider.calls).toHaveLength(1 + corrupt.length);
    });

    it("reports this call's skipped images on a cache hit", async () => {
      stubImageFetch();
      const cache = createMemoryCacheStore();
      const first = await extractBooth(
        input({ images: [image(1), 'https://x.test/missing.jpg'] }),
        options({ cache })
      );
      expect(first.meta).toMatchObject({ cached: false, skippedImages: [1] });

      const reordered = await extractBooth(
        input({ images: ['https://x.test/missing.jpg', image(1)] }),
        options({ cache })
      );
      expect(reordered.meta).toMatchObject({ cached: true, skippedImages: [0] });

      const clean = await extractBooth(input({ images: [image(1)] }), options({ cache }));
      expect(clean.meta.cached).toBe(true);
      expect(clean.meta).not.toHaveProperty('skippedImages');
      expect(provider.calls).toHaveLength(1);
    });

    it('treats a failing store as a miss', async () => {
      const broken: AnalysisCacheStore = {
        get: async () => {
          throw new Error('IDB closed');
        },
        set: async () => {
          throw new Error('quota');
        },
      };
      const result = await extractBooth(input(), options({ cache: broken }));
      expect(result.meta.cached).toBe(false);
    });
  });

  describe('retries and errors', () => {
    it('retries a retryable failure once', async () => {
      useProvider(async (_req, _opts, call) => {
        if (call === 0) throw new AIError('unavailable', 'overloaded', 'openai', 529);
        return ok(wire({ items: [item('Tape', 1)] }));
      });
      const result = await extractBooth(input(), options());
      expect(provider.calls).toHaveLength(2);
      expect(result.items).toHaveLength(1);
    });

    it('gives up after the second retryable failure', async () => {
      useProvider(async () => {
        throw new AIError('rate_limit', 'slow down', 'openai', 429);
      });
      await expect(extractBooth(input(), options())).rejects.toMatchObject({ code: 'rate_limit' });
      expect(provider.calls).toHaveLength(2);
    });

    it('does not retry non-retryable failures', async () => {
      useProvider(async () => {
        throw new AIError('auth', 'bad key', 'openai', 401);
      });
      await expect(extractBooth(input(), options())).rejects.toMatchObject({ code: 'auth' });
      expect(provider.calls).toHaveLength(1);
    });

    it('times out an attempt that goes quiet and reports timeout', async () => {
      useProvider((_req, opts) => {
        opts.onText?.('{"booth"');
        return untilAborted(opts);
      });
      await expect(
        extractBooth(input(), options({ idleTimeoutMs: 15, callTimeoutMs: 5000 }))
      ).rejects.toMatchObject({ name: 'AIError', code: 'timeout' });
      expect(provider.calls).toHaveLength(2);
    });

    it('keeps a call alive past the idle limit while it streams', async () => {
      useProvider(async (_req, opts) => {
        for (let i = 1; i <= 6; i++) {
          opts.onText?.('{"items":['.slice(0, i));
          await sleep(20);
        }
        return ok(wire({ items: [item('Tape', 1)] }));
      });
      const result = await extractBooth(input(), options({ idleTimeoutMs: 50, callTimeoutMs: 5000 }));
      expect(result.items).toHaveLength(1);
      expect(provider.calls).toHaveLength(1);
    });

    it('caps a call that keeps streaming past the overall limit', async () => {
      useProvider(async (_req, opts) => {
        while (!opts.signal?.aborted) {
          opts.onText?.('{');
          await sleep(5);
        }
        throw opts.signal.reason;
      });
      await expect(
        extractBooth(input(), options({ idleTimeoutMs: 5000, callTimeoutMs: 40 }))
      ).rejects.toMatchObject({ name: 'AIError', code: 'timeout' });
      expect(provider.calls).toHaveLength(2);
    });

    it('uses longer budgets for the accurate tier', () => {
      expect(CALL_TIMEOUTS.fast).toEqual({ idleMs: 30_000, totalMs: 180_000 });
      expect(CALL_TIMEOUTS.accurate.idleMs).toBeGreaterThan(CALL_TIMEOUTS.fast.idleMs);
      expect(CALL_TIMEOUTS.accurate.totalMs).toBeGreaterThan(CALL_TIMEOUTS.fast.totalMs);
    });

    it('stops without retrying when the caller cancels', async () => {
      const controller = new AbortController();
      useProvider((_req, opts) => {
        queueMicrotask(() => controller.abort());
        return untilAborted(opts);
      });
      await expect(extractBooth(input({ signal: controller.signal }), options())).rejects.toMatchObject({
        code: 'cancelled',
      });
      expect(provider.calls).toHaveLength(1);
    });

    it('times out a stalled image download without calling the provider when nothing else is left', async () => {
      stubImageFetch();
      await expect(
        extractBooth(
          input({ text: '', images: ['https://pbs.twimg.com/media/stalled.jpg'] }),
          options({ imageTimeoutMs: 15 })
        )
      ).rejects.toMatchObject({ name: 'AIError', code: 'timeout' });
      expect(provider.calls).toHaveLength(0);
    });

    it('skips images that cannot be loaded and analyzes the rest', async () => {
      stubImageFetch();
      const result = await extractBooth(
        input({ images: ['https://x.test/stalled.jpg', image(1), 'https://x.test/missing.jpg'] }),
        // Long enough that the local blob always finishes before the stalled URL is cut off.
        options({ imageTimeoutMs: 250 })
      );
      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.req).toMatchObject({ text: 'Booth A-01 price list' });
      expect(provider.calls[0]?.req.images).toHaveLength(1);
      expect(result.meta.skippedImages).toEqual([0, 2]);
    });

    it('falls back to the text alone when every image fails', async () => {
      stubImageFetch();
      const result = await extractBooth(input({ images: ['https://x.test/missing.jpg'] }), options());
      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.req.images).toEqual([]);
      expect(result.meta.skippedImages).toEqual([0]);
    });

    it('throws the first image error when there is no text and no image loads', async () => {
      stubImageFetch();
      const corrupt: ImageCodec<DecodedImage> = {
        ...codec,
        decode: async () => {
          throw new Error('corrupt');
        },
      };
      await expect(
        extractBooth(
          input({ text: ' ', images: ['https://x.test/missing.jpg', image(1)] }),
          options({ codec: corrupt })
        )
      ).rejects.toMatchObject({ name: 'AIError', code: 'network', status: 404 });
      expect(provider.calls).toHaveLength(0);
    });

    it('aborts in-flight image downloads when the caller cancels', async () => {
      const { signals } = stubImageFetch();
      const controller = new AbortController();
      const pending = extractBooth(
        input({ images: ['https://x.test/stalled-1.jpg', 'https://x.test/stalled-2.jpg'], signal: controller.signal }),
        options()
      );
      await vi.waitFor(() => expect(signals).toHaveLength(2));
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: 'AIError', code: 'cancelled' });
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(provider.calls).toHaveLength(0);
    });

    it('rejects immediately when already cancelled', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(extractBooth(input({ signal: controller.signal }), options())).rejects.toMatchObject({
        code: 'cancelled',
      });
      expect(provider.calls).toHaveLength(0);
    });

    it('aborts sibling calls when one fails', async () => {
      const aborted: boolean[] = [];
      useProvider(async (_req, opts, call) => {
        if (call === 1) throw new AIError('auth', 'bad key', 'openai', 401);
        await untilAborted(opts).catch(() => aborted.push(true));
        throw new AIError('cancelled', 'x', 'openai');
      });
      await expect(
        extractBooth(input({ images: [image(1), image(2)] }), options())
      ).rejects.toMatchObject({ code: 'auth' });
      await vi.waitFor(() => expect(aborted).toEqual([true]));
    });

    it('normalizes non-AIError failures and invalid wire output', async () => {
      useProvider(async () => {
        throw new RangeError('boom');
      });
      await expect(extractBooth(input(), options())).rejects.toMatchObject({ name: 'AIError', code: 'unknown' });

      useProvider(async () => ({ wire: { nope: true } as unknown as WireExtraction, model: 'm' }));
      await expect(extractBooth(input(), options())).rejects.toMatchObject({ code: 'bad_response' });
    });

    it('rejects empty input and missing configuration', async () => {
      await expect(extractBooth(input({ text: '  ' }), options())).rejects.toMatchObject({ code: 'unknown' });
      await expect(
        extractBooth(input(), options({ settings: DEFAULT_AI_SETTINGS }))
      ).rejects.toMatchObject({ code: 'not_configured' });
    });
  });

  describe('partial streaming', () => {
    const full = (items: WireItem[]) => JSON.stringify(wire({ currency: 'KRW', items }));

    function streamText(opts: ProviderCallOptions, text: string, step = 5) {
      for (let i = step; i < text.length + step; i += step) opts.onText?.(text.slice(0, i));
    }

    it('emits merged items across calls as their count grows', async () => {
      const perCall = [
        [item('Keyring', 5000, ['A']), item('Sticker', 1500)],
        [item('keyring', 5000, ['B']), item('Postcard', 2000)],
      ];
      useProvider(async (_req, opts, call) => {
        const items = perCall[call] ?? [];
        streamText(opts, full(items));
        return ok(wire({ items }));
      });
      const updates: PartialExtraction[] = [];
      const result = await extractBooth(
        input({ images: [image(1), image(2)], onPartial: (p) => updates.push(p) }),
        options()
      );
      const counts = updates.map((u) => u.items.length);
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
      expect(new Set(counts).size).toBe(counts.length);
      expect(updates.at(-1)?.items.map((i) => i.name)).toEqual(['Keyring', 'Sticker', 'Postcard']);
      expect(result.items).toHaveLength(3);
    });

    it('does not re-emit stale counts after a retry restarts a stream', async () => {
      const items = [item('Keyring', 5000), item('Sticker', 1500)];
      // The first attempt drops right after the first item closes.
      const firstItemEnd = full(items).indexOf('},{') + 1;
      useProvider(async (_req, opts, call) => {
        streamText(opts, full(items).slice(0, call === 0 ? firstItemEnd : undefined), 1);
        if (call === 0) throw new AIError('network', 'dropped', 'openai');
        return ok(wire({ items }));
      });
      const counts: number[] = [];
      await extractBooth(input({ onPartial: (p) => counts.push(p.items.length) }), options());
      expect(counts).toEqual([1, 2]);
    });

    it('survives a throwing onPartial callback', async () => {
      useProvider(async (_req, opts) => {
        streamText(opts, full([item('Tape', 4000)]));
        return ok(wire({ items: [item('Tape', 4000)] }));
      });
      const result = await extractBooth(
        input({
          onPartial: () => {
            throw new Error('render bug');
          },
        }),
        options()
      );
      expect(result.items).toHaveLength(1);
    });
  });
});
