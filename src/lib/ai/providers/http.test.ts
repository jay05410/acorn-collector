import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '../testing';
import { classifyStatus, errorInfoFromBody, getJson, parseEventData, redactSecrets, send, streamMessages } from './http';

const ctx = { provider: 'openai' as const, apiKey: 'sk-secret-abcdef', classify: () => 'unknown' as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyStatus', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [402, 'quota'],
    [408, 'timeout'],
    [429, 'rate_limit'],
    [500, 'unavailable'],
    [529, 'unavailable'],
    [400, 'unknown'],
    [undefined, 'unknown'],
  ])('%s -> %s', (status, code) => {
    expect(classifyStatus(status)).toBe(code);
  });
});

describe('redactSecrets', () => {
  it('removes the exact key and anything key-shaped, and caps length', () => {
    expect(redactSecrets('bad key sk-secret-abcdef here', 'sk-secret-abcdef')).toBe('bad key [redacted] here');
    expect(redactSecrets('Incorrect API key provided: sk-proj-****wxyz.', '')).toBe(
      'Incorrect API key provided: sk-[redacted]'
    );
    expect(redactSecrets('x'.repeat(1000), 'k')).toHaveLength(300);
  });
});

describe('errorInfoFromBody', () => {
  it('reads string and numeric codes', () => {
    expect(errorInfoFromBody({ error: { message: 'm', type: 't', code: 'c' } }, 429, '')).toEqual({
      status: 429,
      type: 't',
      code: 'c',
      message: 'm',
      metadata: undefined,
    });
    expect(errorInfoFromBody({ error: { code: 502, message: 'up', metadata: { a: 1 } } }, undefined, '')).toMatchObject({
      status: 502,
      code: '502',
      metadata: { a: 1 },
    });
  });

  it('falls back when the body is not an error envelope', () => {
    expect(errorInfoFromBody('oops', 503, '').message).toBe('HTTP 503');
    expect(errorInfoFromBody(undefined, undefined, '').message).toBe('Provider error');
  });
});

describe('send', () => {
  it('omits credentials and passes the signal through', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    const controller = new AbortController();
    await send('https://x.test', { method: 'POST' }, { ...ctx, signal: controller.signal });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
    });
  });

  it('uses the classifier for non-2xx responses and keeps the status', async () => {
    mockFetch(() => jsonResponse(418, { error: { message: 'teapot sk-secret-abcdef' } }));
    await expect(
      send('https://x.test', {}, { ...ctx, classify: () => 'refused' })
    ).rejects.toMatchObject({ code: 'refused', status: 418, message: 'teapot [redacted]' });
  });
});

describe('getJson', () => {
  it('maps unparseable bodies to bad_response', async () => {
    mockFetch(() => new Response('<html>', { status: 200 }));
    await expect(getJson('https://x.test', {}, ctx)).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('streamMessages / parseEventData', () => {
  it('rejects responses without a body', async () => {
    const iterate = async () => {
      for await (const _ of streamMessages(new Response(null), 'openai', undefined)) void _;
    };
    await expect(iterate()).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('rejects non-object event data', () => {
    expect(() => parseEventData('[1]', 'anthropic')).toThrowError(
      expect.objectContaining({ code: 'bad_response' })
    );
    expect(() => parseEventData('{', 'anthropic')).toThrowError(
      expect.objectContaining({ code: 'bad_response' })
    );
  });
});
