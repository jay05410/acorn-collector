import { describe, expect, it } from 'vitest';
import { AIError } from '@/lib/ai/types';
import { BRIDGE_MESSAGES, fromHostError, fromRuntimeError } from './errors';
import {
  BRIDGE_HOST_ERROR_CODES,
  BRIDGE_HOST_NAME,
  BRIDGE_MAX_PAYLOAD_BYTES,
  BRIDGE_PROTOCOL_VERSION,
  analyzePayloadBytes,
  isBridgeAnalyzeResult,
  isBridgeResponse,
  isBridgeStatus,
} from './protocol';

/** Import a native-host module (plain .mjs, outside the TS project). */
async function hostModule<T>(relativePath: string): Promise<T> {
  const url = new URL(`../../../native-host/${relativePath}`, import.meta.url)
    .href;
  return (await import(/* @vite-ignore */ url)) as T;
}

describe('protocol parity with the native host', () => {
  it('shares error codes, host name and protocol version', async () => {
    const { HOST_ERROR_CODES } = await hostModule<{
      HOST_ERROR_CODES: readonly string[];
    }>('lib/errors.mjs');
    const { HOST_NAME } = await hostModule<{ HOST_NAME: string }>(
      'lib/install-plan.mjs'
    );
    const { PROTOCOL_VERSION } = await hostModule<{ PROTOCOL_VERSION: number }>(
      'protocol.mjs'
    );
    expect([...BRIDGE_HOST_ERROR_CODES].sort()).toEqual(
      [...HOST_ERROR_CODES].sort()
    );
    expect(BRIDGE_HOST_NAME).toBe(HOST_NAME);
    expect(BRIDGE_PROTOCOL_VERSION).toBe(PROTOCOL_VERSION);
  });

  it('measures and caps the analyze payload like the host validator', async () => {
    const { MAX_PAYLOAD_BYTES, payloadBytes } = await hostModule<{
      MAX_PAYLOAD_BYTES: number;
      payloadBytes: (request: unknown) => number;
    }>('lib/validate.mjs');
    expect(BRIDGE_MAX_PAYLOAD_BYTES).toBe(MAX_PAYLOAD_BYTES);
    const request = {
      system: 'Rules: "quote" \\ back\nslash',
      text: '東ホ-12a 新刊 1500円 🐿️ \u0001',
      images: [
        { mimeType: 'image/jpeg' as const, base64: '/9j/AAAA' },
        { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' },
      ],
      schema: { type: 'object', description: 'booth ブース' },
    };
    expect(analyzePayloadBytes(request)).toBe(payloadBytes(request));
  });
});

describe('isBridgeResponse', () => {
  it('accepts heartbeats, results and errors', () => {
    expect(isBridgeResponse({ id: 'r1', status: 'running' })).toBe(true);
    expect(isBridgeResponse({ id: 'r1', status: 'queued' })).toBe(true);
    expect(isBridgeResponse({ id: 'r1', status: 'ok', result: null })).toBe(
      true
    );
    expect(
      isBridgeResponse({
        id: null,
        status: 'error',
        error: { code: 'bad_request', message: 'x' },
      })
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isBridgeResponse(null)).toBe(false);
    expect(isBridgeResponse({ id: 1, status: 'ok', result: 1 })).toBe(false);
    expect(isBridgeResponse({ id: 'r1', status: 'ok' })).toBe(false);
    expect(isBridgeResponse({ id: 'r1', status: 'done' })).toBe(false);
    expect(
      isBridgeResponse({
        id: 'r1',
        status: 'error',
        error: { code: 'nope', message: 'x' },
      })
    ).toBe(false);
  });
});

describe('result guards', () => {
  it('validates analyze results', () => {
    expect(
      isBridgeAnalyzeResult({ output: {}, model: null, usage: null })
    ).toBe(true);
    expect(
      isBridgeAnalyzeResult({
        output: {},
        model: 'm',
        usage: { inputTokens: 1 },
      })
    ).toBe(true);
    expect(
      isBridgeAnalyzeResult({ output: [], model: null, usage: null })
    ).toBe(false);
    expect(isBridgeAnalyzeResult({ output: {}, model: 1, usage: null })).toBe(
      false
    );
    expect(
      isBridgeAnalyzeResult({
        output: {},
        model: null,
        usage: { inputTokens: '1' },
      })
    ).toBe(false);
  });

  it('validates status results', () => {
    const target = {
      installed: true,
      loggedIn: false,
      authMethod: null,
      subscriptionType: null,
      warnings: ['status_check_failed'],
    };
    const status = {
      protocol: 1,
      platform: 'linux',
      targets: { claude: target, codex: target },
    };
    expect(isBridgeStatus(status)).toBe(true);
    expect(isBridgeStatus({ ...status, targets: { claude: target } })).toBe(
      false
    );
    expect(
      isBridgeStatus({
        ...status,
        targets: { claude: { ...target, warnings: [1] }, codex: target },
      })
    ).toBe(false);
  });
});

describe('error mapping', () => {
  it('maps every host error code to an AIError with a known message code', () => {
    for (const code of BRIDGE_HOST_ERROR_CODES) {
      const error = fromHostError({ code, message: `detail for ${code}` });
      expect(error).toBeInstanceOf(AIError);
      expect(error.provider).toBe('cli');
      expect(BRIDGE_MESSAGES).toContain(error.message);
      expect(error.cause).toBe(`detail for ${code}`);
    }
    expect(fromHostError({ code: 'timeout', message: '' }).code).toBe(
      'timeout'
    );
    expect(fromHostError({ code: 'cli_not_found', message: '' }).code).toBe(
      'not_configured'
    );
    expect(fromHostError({ code: 'bad_output', message: '' }).code).toBe(
      'bad_response'
    );
    expect(
      fromHostError({ code: 'origin_not_allowed', message: '' })
    ).toMatchObject({ code: 'not_configured', message: 'bridge_forbidden' });
  });

  it('marks only transient host failures as retryable', () => {
    const retryable = BRIDGE_HOST_ERROR_CODES.filter(
      (code) => fromHostError({ code, message: '' }).retryable
    );
    expect(retryable.sort()).toEqual(['busy', 'rate_limited', 'timeout']);
    expect(fromHostError({ code: 'cli_failed', message: '' }).code).toBe(
      'unknown'
    );
  });

  it('maps chrome.runtime.lastError messages', () => {
    expect(
      fromRuntimeError('Specified native messaging host not found.')
    ).toMatchObject({
      code: 'not_configured',
      message: 'bridge_not_installed',
      retryable: false,
    });
    expect(
      fromRuntimeError(
        'Access to the specified native messaging host is forbidden.'
      )
    ).toMatchObject({
      code: 'not_configured',
      message: 'bridge_forbidden',
      retryable: false,
    });
    const exited = fromRuntimeError('Native host has exited.');
    expect(exited.code).toBe('unavailable');
    expect(exited.retryable).toBe(true);
    expect(exited.message).toBe('bridge_disconnected');
    expect(fromRuntimeError(undefined).cause).toBeUndefined();
  });
});
