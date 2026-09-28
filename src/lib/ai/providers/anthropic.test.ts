import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL_TABLE } from '../models';
import { WIRE_SCHEMA_ANY_OF } from '../schema';
import {
  extractionRequest,
  jsonResponse,
  mockFetch,
  pieces,
  requestBody,
  requestHeaders,
  sseResponse,
  stallingSseResponse,
  TEST_IMAGE,
  WIRE_JSON,
} from '../testing';
import { anthropicProvider, buildAnthropicRequest } from './anthropic';

const SONNET = MODEL_TABLE.anthropic.fast;
const OPUS = MODEL_TABLE.anthropic.accurate;
const KEY = 'sk-ant-api03-test-key-0123456789';

function sse(type: string, payload: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

interface TranscriptOptions {
  thinking?: boolean;
  stopReason?: string;
  tail?: string;
}

/** Messages API stream in the documented order (ping and thinking included). */
function messagesTranscript(text: string, opts: TranscriptOptions = {}): string {
  const events = [
    sse('message_start', {
      message: {
        id: 'msg_01',
        type: 'message',
        role: 'assistant',
        model: SONNET,
        content: [],
        stop_reason: null,
        usage: { input_tokens: 2100, cache_creation_input_tokens: 0, cache_read_input_tokens: 40, output_tokens: 1 },
      },
    }),
  ];
  let index = 0;
  if (opts.thinking) {
    events.push(
      sse('content_block_start', { index, content_block: { type: 'thinking', thinking: '' } }),
      sse('content_block_delta', { index, delta: { type: 'thinking_delta', thinking: '' } }),
      sse('content_block_delta', { index, delta: { type: 'signature_delta', signature: 'EqQBCgIYAh' } }),
      sse('content_block_stop', { index })
    );
    index++;
  }
  events.push(sse('content_block_start', { index, content_block: { type: 'text', text: '' } }), sse('ping'));
  for (const piece of pieces(text)) {
    events.push(sse('content_block_delta', { index, delta: { type: 'text_delta', text: piece } }));
  }
  events.push(
    sse('content_block_stop', { index }),
    sse('message_delta', {
      delta: { stop_reason: opts.stopReason ?? 'end_turn', stop_sequence: null },
      usage: { output_tokens: 187 },
    }),
    opts.tail ?? sse('message_stop')
  );
  return events.join('');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAnthropicRequest', () => {
  it('disables thinking on Sonnet 5 and sends the anyOf schema', () => {
    const body = buildAnthropicRequest(extractionRequest(), SONNET);
    expect(body).toMatchObject({
      model: SONNET,
      max_tokens: 8192,
      stream: true,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: WIRE_SCHEMA_ANY_OF } },
    });
    expect(body.output_config).not.toHaveProperty('effort');
    expect(body.system).toContain('translated into Korean');
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: TEST_IMAGE.base64 } },
          { type: 'text', text: expect.stringContaining('Booth A-01') },
        ],
      },
    ]);
  });

  it('keeps thinking on for Opus 5.5 and lowers effort instead', () => {
    const body = buildAnthropicRequest(extractionRequest({ tier: 'accurate' }), OPUS);
    expect(body).not.toHaveProperty('thinking');
    expect(body).toMatchObject({ max_tokens: 16000, output_config: { effort: 'low' } });
  });
});

describe('anthropicProvider.extract', () => {
  it('streams text blocks, skips thinking and reports usage', async () => {
    const fetchMock = mockFetch(() => sseResponse(messagesTranscript(WIRE_JSON, { thinking: true })));
    const seen: string[] = [];
    const result = await anthropicProvider.extract(extractionRequest(), {
      apiKey: KEY,
      model: SONNET,
      onText: (t) => seen.push(t),
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.anthropic.com/v1/messages');
    const headers = requestHeaders(fetchMock);
    expect(headers.get('x-api-key')).toBe(KEY);
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(requestBody(fetchMock).model).toBe(SONNET);
    expect(result).toMatchObject({ model: SONNET, inputTokens: 2140, outputTokens: 187 });
    expect(result.wire.items).toHaveLength(2);
    expect(seen.at(-1)).toBe(WIRE_JSON);
  });

  it.each([
    [401, 'authentication_error', 'auth'],
    [403, 'permission_error', 'auth'],
    [402, 'billing_error', 'quota'],
    [429, 'rate_limit_error', 'rate_limit'],
    [500, 'api_error', 'unavailable'],
    [529, 'overloaded_error', 'unavailable'],
    [404, 'not_found_error', 'unknown'],
    [413, 'request_too_large', 'unknown'],
  ])('maps HTTP %i %s to %s', async (status, type, code) => {
    mockFetch(() =>
      jsonResponse(status, { type: 'error', error: { type, message: `nope ${KEY}` }, request_id: 'req_1' })
    );
    const error = await anthropicProvider
      .extract(extractionRequest(), { apiKey: KEY, model: SONNET })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AIError', code, provider: 'anthropic', status });
    expect((error as Error).message).not.toContain(KEY);
  });

  it('maps a low credit balance 400 to quota', async () => {
    mockFetch(() =>
      jsonResponse(400, {
        type: 'error',
        error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' },
      })
    );
    await expect(
      anthropicProvider.extract(extractionRequest(), { apiKey: KEY, model: SONNET })
    ).rejects.toMatchObject({ code: 'quota' });
  });

  it('maps mid-stream overloaded errors to a retryable unavailable', async () => {
    const overloaded = 'event: error\ndata: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}\n\n';
    mockFetch(() => sseResponse(messagesTranscript('{"booth"', { tail: overloaded })));
    await expect(
      anthropicProvider.extract(extractionRequest(), { apiKey: KEY, model: SONNET })
    ).rejects.toMatchObject({ code: 'unavailable', retryable: true, message: 'Overloaded' });
  });

  it('maps refusal and max_tokens stop reasons', async () => {
    mockFetch(() => sseResponse(messagesTranscript('', { stopReason: 'refusal' })));
    await expect(
      anthropicProvider.extract(extractionRequest(), { apiKey: KEY, model: SONNET })
    ).rejects.toMatchObject({ code: 'refused' });

    mockFetch(() => sseResponse(messagesTranscript('{"booth":{', { stopReason: 'max_tokens' })));
    await expect(
      anthropicProvider.extract(extractionRequest(), { apiKey: KEY, model: SONNET })
    ).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('treats a stream without message_stop as a network failure', async () => {
    mockFetch(() => sseResponse(messagesTranscript(WIRE_JSON, { tail: '' })));
    await expect(
      anthropicProvider.extract(extractionRequest(), { apiKey: KEY, model: SONNET })
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('maps a timeout abort mid-stream', async () => {
    mockFetch((_url, init) => stallingSseResponse(messagesTranscript('{"b', { tail: '' }), init.signal));
    const controller = new AbortController();
    await expect(
      anthropicProvider.extract(extractionRequest(), {
        apiKey: KEY,
        model: SONNET,
        signal: controller.signal,
        onText: () => controller.abort(new DOMException('slow', 'TimeoutError')),
      })
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('anthropicProvider', () => {
  it('uses the model table for defaults', () => {
    expect(anthropicProvider.defaultModel('fast')).toBe(SONNET);
    expect(anthropicProvider.defaultModel('accurate')).toBe(OPUS);
  });

  it('tests the connection with GET /v1/models', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { data: [], has_more: true }));
    await anthropicProvider.testConnection({ apiKey: KEY, model: SONNET });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.anthropic.com/v1/models?limit=1');
    expect(requestHeaders(fetchMock).get('anthropic-dangerous-direct-browser-access')).toBe('true');
  });
});
