import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL_TABLE, SELECTABLE_MODELS } from '../models';
import { WIRE_SCHEMA, WIRE_SCHEMA_ANY_OF } from '../schema';
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
import { buildOpenRouterRequest, getOpenRouterKeyInfo, openrouterProvider } from './openrouter';

const FAST = MODEL_TABLE.openrouter.fast;
const ACCURATE = MODEL_TABLE.openrouter.accurate;
const KEY = 'sk-or-v1-test-key-0123456789';

function chunk(delta: Record<string, unknown>, finish: string | null = null): string {
  const body = {
    id: 'gen-1',
    provider: 'Anthropic',
    model: ACCURATE,
    object: 'chat.completion.chunk',
    created: 1790000000,
    choices: [{ index: 0, delta, finish_reason: finish, native_finish_reason: finish }],
  };
  return `data: ${JSON.stringify(body)}\n\n`;
}

/** Chat completions stream as OpenRouter sends it (keep-alive comments, usage chunk, [DONE]). */
function chatTranscript(text: string, opts: { finish?: string | null; tail?: string } = {}): string {
  return [
    ': OPENROUTER PROCESSING\n\n',
    chunk({ role: 'assistant', content: '' }),
    ...pieces(text).map((content) => chunk({ content })),
    ': OPENROUTER PROCESSING\n\n',
    opts.finish === null ? '' : chunk({ content: '' }, opts.finish ?? 'stop'),
    opts.tail ??
      `data: ${JSON.stringify({ id: 'gen-1', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 2210, completion_tokens: 151, total_tokens: 2361, cost: 0.0059 } })}\n\ndata: [DONE]\n\n`,
  ].join('');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildOpenRouterRequest', () => {
  it('sends response_format, require_parameters and model-specific reasoning', () => {
    const body = buildOpenRouterRequest(extractionRequest(), FAST);
    expect(body).toMatchObject({
      model: FAST,
      stream: true,
      reasoning: { effort: 'none' },
      provider: { require_parameters: true },
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'booth_extraction', strict: true, schema: WIRE_SCHEMA },
      },
    });
    expect(body.messages).toEqual([
      { role: 'system', content: expect.stringContaining('translated into Korean') },
      {
        role: 'user',
        content: [
          { type: 'text', text: expect.stringContaining('Booth A-01') },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${TEST_IMAGE.base64}` } },
        ],
      },
    ]);
  });

  it('uses the anyOf schema and disables reasoning for Claude Sonnet 5', () => {
    const body = buildOpenRouterRequest(extractionRequest({ tier: 'accurate' }), ACCURATE);
    expect(body).toMatchObject({
      reasoning: { enabled: false },
      response_format: { json_schema: { schema: WIRE_SCHEMA_ANY_OF } },
    });
  });

  it('omits reasoning for models whose default is already off', () => {
    const mistral = SELECTABLE_MODELS.openrouter.find((m) => m.startsWith('mistralai/'));
    expect(mistral).toBeDefined();
    expect(buildOpenRouterRequest(extractionRequest(), mistral ?? '')).not.toHaveProperty('reasoning');
  });
});

describe('openrouterProvider.extract', () => {
  it('streams content deltas, ignores comments and reads the usage chunk', async () => {
    const fetchMock = mockFetch(() => sseResponse(chatTranscript(WIRE_JSON)));
    const seen: string[] = [];
    const result = await openrouterProvider.extract(extractionRequest({ tier: 'accurate' }), {
      apiKey: KEY,
      model: ACCURATE,
      onText: (t) => seen.push(t),
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = requestHeaders(fetchMock);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('HTTP-Referer')).toBe('https://github.com/jay05410/acorn-collector');
    expect(headers.get('X-OpenRouter-Title')).toBe('Acorn Collector');
    expect(requestBody(fetchMock).model).toBe(ACCURATE);
    expect(result).toMatchObject({ model: ACCURATE, inputTokens: 2210, outputTokens: 151 });
    expect(result.wire.items[1]?.opts).toEqual(['A', 'B', 'C', 'D']);
    expect(seen.at(-1)).toBe(WIRE_JSON);
  });

  it.each([
    [401, { error: { code: 401, message: `Invalid key ${KEY}` } }, 'auth'],
    [402, { error: { code: 402, message: 'Insufficient credits' } }, 'quota'],
    [403, { error: { code: 403, message: 'Flagged', metadata: { reasons: ['violence'], flagged_input: 'x' } } }, 'refused'],
    [408, { error: { code: 408, message: 'Timed out' } }, 'timeout'],
    [429, { error: { code: 429, message: 'Rate limited' } }, 'rate_limit'],
    [502, { error: { code: 502, message: 'Provider returned error' } }, 'unavailable'],
    [503, { error: { code: 503, message: 'No endpoints found that support all parameters' } }, 'unavailable'],
    [400, { error: { code: 400, message: 'Bad request' } }, 'unknown'],
  ])('maps HTTP %i to %s', async (status, body, code) => {
    mockFetch(() => jsonResponse(status, body));
    const error = await openrouterProvider
      .extract(extractionRequest(), { apiKey: KEY, model: FAST })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AIError', code, provider: 'openrouter', status });
    expect((error as Error).message).not.toContain(KEY);
  });

  it('maps mid-stream error chunks (HTTP 200) by their code', async () => {
    const errorChunk = `data: ${JSON.stringify({
      id: 'gen-1',
      object: 'chat.completion.chunk',
      error: { code: 502, message: 'Upstream died', metadata: { error_type: 'provider_error' } },
      choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }],
    })}\n\n`;
    mockFetch(() => sseResponse(chatTranscript('{"booth"', { finish: null, tail: errorChunk })));
    await expect(
      openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST })
    ).rejects.toMatchObject({ code: 'unavailable', status: 502, retryable: true });
  });

  it('maps finish reasons length, content_filter and refusals', async () => {
    mockFetch(() => sseResponse(chatTranscript('{"booth":', { finish: 'length' })));
    await expect(
      openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST })
    ).rejects.toMatchObject({ code: 'bad_response' });

    mockFetch(() => sseResponse(chatTranscript('', { finish: 'content_filter' })));
    await expect(
      openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST })
    ).rejects.toMatchObject({ code: 'refused' });

    mockFetch(() => sseResponse(chunk({ refusal: 'No.' })));
    await expect(
      openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST })
    ).rejects.toMatchObject({ code: 'refused', message: 'No.' });
  });

  it('accepts a stream that ends after finish_reason without [DONE]', async () => {
    mockFetch(() => sseResponse(chatTranscript(WIRE_JSON, { tail: '' })));
    const result = await openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST });
    expect(result.wire.items).toHaveLength(2);
    expect(result.inputTokens).toBeUndefined();
  });

  it('treats a stream cut before any finish as network, and aborts as cancelled', async () => {
    mockFetch(() => sseResponse(chunk({ content: '{"booth"' })));
    await expect(
      openrouterProvider.extract(extractionRequest(), { apiKey: KEY, model: FAST })
    ).rejects.toMatchObject({ code: 'network' });

    mockFetch((_url, init) => stallingSseResponse(chunk({ content: '{' }), init.signal));
    const controller = new AbortController();
    await expect(
      openrouterProvider.extract(extractionRequest(), {
        apiKey: KEY,
        model: FAST,
        signal: controller.signal,
        onText: () => controller.abort(),
      })
    ).rejects.toMatchObject({ code: 'cancelled' });
  });
});

describe('getOpenRouterKeyInfo', () => {
  it('maps the key endpoint response', async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, {
        data: {
          label: 'Acorn Collector',
          limit: 10,
          limit_remaining: 7.5,
          limit_reset: 'monthly',
          usage: 2.5,
          usage_daily: 0.1,
          is_free_tier: false,
        },
      })
    );
    expect(await getOpenRouterKeyInfo(KEY)).toEqual({
      label: 'Acorn Collector',
      limit: 10,
      limitRemaining: 7.5,
      limitReset: 'monthly',
      usage: 2.5,
      isFreeTier: false,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/key');
  });

  it('treats null limits as unlimited and rejects malformed bodies', async () => {
    mockFetch(() => jsonResponse(200, { data: { label: 'x', limit: null, limit_remaining: null, usage: 0, is_free_tier: true } }));
    expect(await getOpenRouterKeyInfo(KEY)).toMatchObject({ limit: null, limitRemaining: null, isFreeTier: true });

    mockFetch(() => jsonResponse(200, { nope: true }));
    await expect(getOpenRouterKeyInfo(KEY)).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('backs testConnection', async () => {
    mockFetch(() => jsonResponse(401, { error: { code: 401, message: 'No auth credentials found' } }));
    await expect(openrouterProvider.testConnection({ apiKey: KEY, model: FAST })).rejects.toMatchObject({
      code: 'auth',
    });
  });
});
