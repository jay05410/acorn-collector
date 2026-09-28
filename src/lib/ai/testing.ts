// i18n-scan-ignore-file: multilingual test fixtures
/**
 * Test-only helpers (imported by *.test.ts files, never by shipped code):
 * fake fetch responses that stream SSE transcripts in small chunks.
 */
import { vi } from 'vitest';
import type { ExtractionRequest, ImageInput } from './types';

const encoder = new TextEncoder();

/** Streams `transcript` in `chunkSize`-character pieces to exercise re-assembly. */
export function sseResponse(transcript: string, chunkSize = 23): Response {
  const bytes = encoder.encode(transcript);
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/**
 * A stream that sends `prefix` and then stalls until `signal` aborts, erroring
 * the body with the abort reason the way fetch() does.
 */
export function stallingSseResponse(prefix: string, signal: AbortSignal | null | undefined): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(prefix));
      signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
    },
  });
  return new Response(body, { status: 200 });
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Replaces global fetch; returns the mock for call assertions. */
export function mockFetch(handler: FetchHandler) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init ?? {})
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Parsed JSON body of the n-th fetch call. */
export function requestBody(mock: ReturnType<typeof mockFetch>, call = 0): Record<string, unknown> {
  const init = mock.mock.calls[call]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

export function requestHeaders(mock: ReturnType<typeof mockFetch>, call = 0): Headers {
  return new Headers(mock.mock.calls[call]?.[1]?.headers);
}

export const TEST_IMAGE: ImageInput = {
  mimeType: 'image/jpeg',
  base64: '/9j/4AAQ',
  width: 1620,
  height: 2025,
  hash: 'ab'.repeat(32),
};

export function extractionRequest(overrides: Partial<ExtractionRequest> = {}): ExtractionRequest {
  return { text: 'Booth A-01', images: [TEST_IMAGE], targetLanguage: 'ko', tier: 'fast', ...overrides };
}

/** Splits `text` into pieces of `size` characters (for building delta events). */
export function pieces(text: string, size = 9): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

export const WIRE_JSON = JSON.stringify({
  booth: { number: '東ホ-12a', circle: '星屑工房', event: 'コミックマーケット108', zone: null, mailOrder: false },
  currency: 'JPY',
  items: [
    { name: '신간 「星の庭」', orig: '新刊「星の庭」', price: 800, cat: 'book', opts: [] },
    { name: '캔 배지', orig: '缶バッジ', price: 400, cat: 'badge', opts: ['A', 'B', 'C', 'D'] },
  ],
});
