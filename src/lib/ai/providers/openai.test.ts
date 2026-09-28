import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL_TABLE } from '../models';
import { WIRE_SCHEMA } from '../schema';
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
import { buildOpenAIRequest, openaiProvider } from './openai';

const LUNA = MODEL_TABLE.openai.fast;
const SOL = MODEL_TABLE.openai.accurate;
const KEY = 'sk-proj-test-key-0123456789';

function sse(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

/** Responses API stream in the documented event order. */
function responsesTranscript(text: string, tail?: string): string {
  let seq = 0;
  const events = [
    sse('response.created', { sequence_number: seq++, response: { id: 'resp_1', status: 'in_progress', model: `${LUNA}-2026-08-01`, output: [] } }),
    sse('response.in_progress', { sequence_number: seq++, response: { id: 'resp_1', status: 'in_progress' } }),
    sse('response.output_item.added', { sequence_number: seq++, output_index: 0, item: { id: 'msg_1', type: 'message', role: 'assistant', content: [] } }),
    sse('response.content_part.added', { sequence_number: seq++, item_id: 'msg_1', output_index: 0, content_index: 0, part: { type: 'output_text', text: '' } }),
    ...pieces(text).map((delta) =>
      sse('response.output_text.delta', { sequence_number: seq++, item_id: 'msg_1', output_index: 0, content_index: 0, delta })
    ),
    sse('response.output_text.done', { sequence_number: seq++, item_id: 'msg_1', output_index: 0, content_index: 0, text }),
  ];
  events.push(
    tail ??
      sse('response.completed', {
        sequence_number: seq++,
        response: {
          id: 'resp_1',
          status: 'completed',
          model: `${LUNA}-2026-08-01`,
          usage: { input_tokens: 3386, output_tokens: 234, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 3620 },
        },
      })
  );
  return events.join('');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildOpenAIRequest', () => {
  it('matches the benchmarked Responses API request', () => {
    const body = buildOpenAIRequest(
      extractionRequest({ hints: { defaultCurrency: 'JPY' } }),
      LUNA
    );
    expect(body).toMatchObject({
      model: LUNA,
      reasoning: { effort: 'none' },
      stream: true,
      store: false,
      max_output_tokens: 8192,
      text: { format: { type: 'json_schema', name: 'booth_extraction', strict: true, schema: WIRE_SCHEMA } },
    });
    expect(body.instructions).toContain('translated into Korean');
    expect(body.input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: expect.stringContaining('Default currency if the prices show no symbol or unit: JPY') },
          { type: 'input_image', image_url: `data:image/jpeg;base64,${TEST_IMAGE.base64}`, detail: 'high' },
        ],
      },
    ]);
  });

  it('uses low effort for Sol in the accurate tier', () => {
    expect(buildOpenAIRequest(extractionRequest({ tier: 'accurate' }), SOL)).toMatchObject({
      reasoning: { effort: 'low' },
      max_output_tokens: 16000,
    });
  });
});

describe('openaiProvider.extract', () => {
  it('streams text, parses the wire JSON and reports usage', async () => {
    const fetchMock = mockFetch(() => sseResponse(responsesTranscript(WIRE_JSON)));
    const seen: string[] = [];
    const result = await openaiProvider.extract(extractionRequest(), {
      apiKey: KEY,
      model: LUNA,
      onText: (t) => seen.push(t),
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.anything());
    expect(requestHeaders(fetchMock).get('authorization')).toBe(`Bearer ${KEY}`);
    expect(requestBody(fetchMock).model).toBe(LUNA);
    expect(result.model).toBe(`${LUNA}-2026-08-01`);
    expect(result.inputTokens).toBe(3386);
    expect(result.outputTokens).toBe(234);
    expect(result.wire.currency).toBe('JPY');
    expect(result.wire.items.map((i) => i.orig)).toEqual(['新刊「星の庭」', '缶バッジ']);
    expect(seen.length).toBeGreaterThan(10);
    expect(seen.at(-1)).toBe(WIRE_JSON);
    expect(seen.every((t, i) => i === 0 || t.startsWith(seen[i - 1] ?? ''))).toBe(true);
  });

  it.each([
    [401, { error: { message: `Incorrect API key provided: ${KEY}`, type: 'invalid_request_error', code: 'invalid_api_key' } }, 'auth'],
    [429, { error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' } }, 'quota'],
    [429, { error: { message: 'Rate limit reached', type: 'requests', code: 'rate_limit_exceeded' } }, 'rate_limit'],
    [500, { error: { message: 'The server had an error', type: 'server_error', code: null } }, 'unavailable'],
    [503, 'upstream connect error', 'unavailable'],
    [400, { error: { message: "Invalid value: 'none'", type: 'invalid_request_error', code: null } }, 'unknown'],
  ])('maps HTTP %i to %s without leaking the key', async (status, body, code) => {
    mockFetch(() => (typeof body === 'string' ? new Response(body, { status }) : jsonResponse(status, body)));
    const error = await openaiProvider
      .extract(extractionRequest(), { apiKey: KEY, model: LUNA })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AIError', code, provider: 'openai', status });
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it('maps stream error events and failed responses', async () => {
    mockFetch(() =>
      sseResponse(responsesTranscript('{"booth"', sse('error', { code: 'rate_limit_exceeded', message: 'Slow down', param: null })))
    );
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'rate_limit', retryable: true });

    mockFetch(() =>
      sseResponse(
        responsesTranscript('', sse('response.failed', { response: { status: 'failed', error: { code: 'server_error', message: 'boom' } } }))
      )
    );
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'unavailable', message: 'boom' });
  });

  it('reports refusals and truncation', async () => {
    mockFetch(() =>
      sseResponse(responsesTranscript('', sse('response.refusal.done', { refusal: "I can't help with that." })))
    );
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'refused', message: "I can't help with that." });

    mockFetch(() =>
      sseResponse(
        responsesTranscript('{"booth":', sse('response.incomplete', { response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }))
      )
    );
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'bad_response' });

    mockFetch(() =>
      sseResponse(
        responsesTranscript('', sse('response.incomplete', { response: { incomplete_details: { reason: 'content_filter' } } }))
      )
    );
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'refused' });
  });

  it('treats invalid JSON output as bad_response and a cut stream as network', async () => {
    mockFetch(() => sseResponse(responsesTranscript('not json')));
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'bad_response' });

    mockFetch(() => sseResponse(responsesTranscript(WIRE_JSON, '')));
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });

  it('maps mid-stream aborts to cancelled or timeout', async () => {
    mockFetch((_url, init) => stallingSseResponse(responsesTranscript('{"bo', ''), init.signal));
    const cancel = new AbortController();
    const pending = openaiProvider.extract(extractionRequest(), {
      apiKey: KEY,
      model: LUNA,
      signal: cancel.signal,
      onText: () => cancel.abort(),
    });
    await expect(pending).rejects.toMatchObject({ code: 'cancelled', retryable: false });

    const timeout = new AbortController();
    const timed = openaiProvider.extract(extractionRequest(), {
      apiKey: KEY,
      model: LUNA,
      signal: timeout.signal,
      onText: () => timeout.abort(new DOMException('60 s', 'TimeoutError')),
    });
    await expect(timed).rejects.toMatchObject({ code: 'timeout', retryable: true });
  });

  it('maps transport failures to network', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(
      openaiProvider.extract(extractionRequest(), { apiKey: KEY, model: LUNA })
    ).rejects.toMatchObject({ code: 'network' });
  });
});

describe('openaiProvider', () => {
  it('uses the model table for defaults', () => {
    expect(openaiProvider.defaultModel('fast')).toBe(LUNA);
    expect(openaiProvider.defaultModel('accurate')).toBe(SOL);
  });

  it('tests the connection with GET /v1/models', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { object: 'list', data: [] }));
    await openaiProvider.testConnection({ apiKey: KEY, model: LUNA });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/models');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'omit' });

    mockFetch(() => jsonResponse(401, { error: { message: 'bad key', code: 'invalid_api_key' } }));
    await expect(openaiProvider.testConnection({ apiKey: KEY, model: LUNA })).rejects.toMatchObject({
      code: 'auth',
    });
  });
});
