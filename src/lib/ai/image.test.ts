import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, sha256Hex } from './encoding';
import {
  fitWithin,
  MAX_PASSTHROUGH_BYTES,
  prepareImage,
  prepareImages,
  sniffImageType,
  type DecodedImage,
  type ImageCodec,
} from './image';

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38];

function bytes(magic: number[], size = 64): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size);
  out.set(magic);
  return out;
}

/** Fake codec: every decode reports `dims`; encode emits a small JPEG and records its arguments. */
function fakeCodec(dims: { width: number; height: number }) {
  const closed: number[] = [];
  const encodeCalls: Array<[number, number, number]> = [];
  const codec: ImageCodec<DecodedImage> = {
    decode: vi.fn(async () => ({ ...dims, close: () => closed.push(1) })),
    encodeJpeg: vi.fn(async (_image, width, height, quality) => {
      encodeCalls.push([width, height, quality]);
      return new Blob([bytes(JPEG_MAGIC, 16)], { type: 'image/jpeg' });
    }),
  };
  return { codec, closed, encodeCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sniffImageType', () => {
  it('detects JPEG, PNG and WebP by magic bytes', () => {
    expect(sniffImageType(bytes(JPEG_MAGIC))).toBe('image/jpeg');
    expect(sniffImageType(bytes(PNG_MAGIC))).toBe('image/png');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(bytes(GIF_MAGIC))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe('fitWithin', () => {
  it('never upscales', () => {
    expect(fitWithin(800, 600, { maxEdge: 2048 })).toEqual({ width: 800, height: 600 });
  });

  it('limits the long edge exactly', () => {
    expect(fitWithin(4000, 3000, { maxEdge: 2048 })).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(1000, 3000, { maxEdge: 2576 })).toEqual({ width: 858, height: 2576 });
  });

  it('applies the pixel budget when it is tighter', () => {
    const size = fitWithin(2576, 2576, { maxEdge: 2576, maxPixels: 3_750_000 });
    expect(size.width * size.height).toBeLessThanOrEqual(3_750_000);
    expect(size.width).toBe(1936);
  });
});

describe('prepareImage', () => {
  it('passes small JPEGs through untouched and hashes the sent bytes', async () => {
    const original = bytes(JPEG_MAGIC, 1000);
    const { codec, closed, encodeCalls } = fakeCodec({ width: 1620, height: 2025 });
    const image = await prepareImage(new Blob([original]), { maxEdge: 2048, codec });
    expect(image).toEqual({
      mimeType: 'image/jpeg',
      base64: bytesToBase64(original),
      width: 1620,
      height: 2025,
      hash: await sha256Hex(original),
    });
    expect(encodeCalls).toEqual([]);
    expect(closed).toHaveLength(1);
  });

  it('keeps PNG as PNG when no resize is needed', async () => {
    const { codec } = fakeCodec({ width: 100, height: 100 });
    const image = await prepareImage(new Blob([bytes(PNG_MAGIC)]), { maxEdge: 2048, codec });
    expect(image.mimeType).toBe('image/png');
  });

  it('downscales large images to JPEG at quality 0.9', async () => {
    const { codec, encodeCalls } = fakeCodec({ width: 4000, height: 3000 });
    const image = await prepareImage(new Blob([bytes(PNG_MAGIC)]), { maxEdge: 2048, codec });
    expect(encodeCalls).toEqual([[2048, 1536, 0.9]]);
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 2048, height: 1536 });
    expect(image.hash).toBe(await sha256Hex(bytes(JPEG_MAGIC, 16)));
  });

  it('re-encodes unsupported formats and oversized files at the same size', async () => {
    const gif = fakeCodec({ width: 300, height: 200 });
    await prepareImage(new Blob([bytes(GIF_MAGIC)]), { maxEdge: 2048, codec: gif.codec });
    expect(gif.encodeCalls).toEqual([[300, 200, 0.9]]);

    const big = fakeCodec({ width: 300, height: 200 });
    const huge = bytes(JPEG_MAGIC, MAX_PASSTHROUGH_BYTES + 1);
    await prepareImage(new Blob([huge]), { maxEdge: 2048, codec: big.codec });
    expect(big.encodeCalls).toEqual([[300, 200, 0.9]]);
  });

  it('closes the decoded image even when encoding fails', async () => {
    const { codec, closed } = fakeCodec({ width: 5000, height: 5000 });
    vi.mocked(codec.encodeJpeg).mockRejectedValueOnce(new Error('canvas lost'));
    await expect(prepareImage(new Blob([bytes(JPEG_MAGIC)]), { maxEdge: 2048, codec })).rejects.toThrow(
      'canvas lost'
    );
    expect(closed).toHaveLength(1);
  });

  it('maps decode failures to AIError', async () => {
    const { codec } = fakeCodec({ width: 1, height: 1 });
    vi.mocked(codec.decode).mockRejectedValueOnce(new DOMException('bad', 'InvalidStateError'));
    await expect(prepareImage(new Blob([bytes(GIF_MAGIC)]), { maxEdge: 2048, codec })).rejects.toMatchObject({
      name: 'AIError',
      code: 'unknown',
    });
  });

  it('fetches URLs without credentials and records the source URL', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob([bytes(JPEG_MAGIC)])));
    vi.stubGlobal('fetch', fetchMock);
    const { codec } = fakeCodec({ width: 10, height: 10 });
    const url = 'https://pbs.twimg.com/media/x?format=jpg&name=orig';
    const image = await prepareImage(url, { maxEdge: 2048, codec });
    expect(image.sourceUrl).toBe(url);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit' }));

    const dataUrl = `data:image/jpeg;base64,${bytesToBase64(bytes(JPEG_MAGIC))}`;
    expect((await prepareImage(dataUrl, { maxEdge: 2048, codec })).sourceUrl).toBeUndefined();
  });

  it('maps download failures to network, cancelled and timeout', async () => {
    const { codec } = fakeCodec({ width: 10, height: 10 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(prepareImage('https://x.test/a.jpg', { maxEdge: 2048, codec })).rejects.toMatchObject({
      code: 'network',
      status: 404,
    });

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(prepareImage('https://x.test/a.jpg', { maxEdge: 2048, codec })).rejects.toMatchObject({
      code: 'network',
    });

    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      prepareImage('https://x.test/a.jpg', { maxEdge: 2048, codec, signal: cancelled.signal })
    ).rejects.toMatchObject({ code: 'cancelled' });

    const timedOut = new AbortController();
    timedOut.abort(new DOMException('slow', 'TimeoutError'));
    await expect(
      prepareImage('https://x.test/a.jpg', { maxEdge: 2048, codec, signal: timedOut.signal })
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('prepareImages', () => {
  it('preserves order with at most 4 in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const codec: ImageCodec<DecodedImage> = {
      async decode(blob) {
        inFlight++;
        peak = Math.max(peak, inFlight);
        const size = blob.size;
        await new Promise((resolve) => setTimeout(resolve, 20 - size));
        inFlight--;
        return { width: size, height: size, close: () => undefined };
      },
      encodeJpeg: async () => new Blob([bytes(JPEG_MAGIC)]),
    };
    const sources = Array.from({ length: 9 }, (_, i) => new Blob([bytes(JPEG_MAGIC, 10 + i)]));
    const { images, skipped } = await prepareImages(sources, { maxEdge: 2048, codec });
    expect(images.map((i) => i.width)).toEqual(sources.map((s) => s.size));
    expect(skipped).toEqual([]);
    expect(peak).toBe(4);
  });

  it('skips images that fail to download or decode and keeps the rest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
    const decode = vi.fn(async (blob: Blob) => {
      if (blob.size === 11) throw new Error('corrupt');
      return { width: blob.size, height: 1, close: () => undefined };
    });
    const codec: ImageCodec<DecodedImage> = { decode, encodeJpeg: async () => new Blob([bytes(JPEG_MAGIC)]) };
    const sources = [
      new Blob([bytes(JPEG_MAGIC, 10)]),
      'https://x.test/missing.jpg',
      new Blob([bytes(JPEG_MAGIC, 11)]),
      new Blob([bytes(JPEG_MAGIC, 12)]),
    ];
    const result = await prepareImages(sources, { maxEdge: 2048, codec });
    expect(result.images.map((i) => i.width)).toEqual([10, 12]);
    expect(result.skipped).toEqual([1, 2]);
    // The lowest skipped index reports, not the first failure to happen.
    expect(result.firstError).toMatchObject({ name: 'AIError', code: 'network', status: 404 });
  });

  it('records a timeout of the signal as skipped images, not a rejection', async () => {
    const { codec } = fakeCodec({ width: 10, height: 10 });
    const timedOut = new AbortController();
    timedOut.abort(new DOMException('slow', 'TimeoutError'));
    const result = await prepareImages([new Blob([bytes(JPEG_MAGIC)]), 'https://x.test/a.jpg'], {
      maxEdge: 2048,
      codec,
      signal: timedOut.signal,
    });
    expect(result).toMatchObject({ images: [], skipped: [0, 1], firstError: { code: 'timeout' } });
  });

  it('on cancellation aborts in-flight downloads, starts no new work and rejects', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init.signal) signals.push(init.signal);
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          })
      )
    );
    const controller = new AbortController();
    const sources = Array.from({ length: 8 }, (_, i) => `https://x.test/${i}.jpg`);
    const pending = prepareImages(sources, { maxEdge: 2048, signal: controller.signal });
    await vi.waitFor(() => expect(signals).toHaveLength(4));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AIError', code: 'cancelled' });
    expect(signals).toHaveLength(4);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('returns an empty result for no sources', async () => {
    expect(await prepareImages([], { maxEdge: 2048 })).toEqual({ images: [], skipped: [] });
  });
});
