import { describe, expect, it, vi } from 'vitest';
import { AIError, type ExtractionRequest, type WireExtraction } from '@/lib/ai/types';
import type { BridgeClient } from './client';
import { createCliProvider, isWireExtraction } from './provider';
import type { BridgeAnalyzeResult, BridgeStatus, CliTarget } from './protocol';

const WIRE: WireExtraction = {
  booth: { number: '東ホ-12a', circle: '星屑工房', event: null, zone: null, mailOrder: false },
  currency: 'JPY',
  items: [
    { name: '아크릴 스탠드', orig: 'アクリルスタンド', price: 1500, cat: 'stand', opts: [] },
    { name: '캔뱃지', orig: '缶バッジ', price: 400, cat: 'badge', opts: ['A', 'B'] },
  ],
};

const REQ: ExtractionRequest = {
  text: 'post text',
  images: [
    {
      mimeType: 'image/jpeg',
      base64: '/9j/',
      width: 1200,
      height: 900,
      hash: 'abc',
      sourceUrl: 'https://pbs.twimg.com/x.jpg',
    },
  ],
  targetLanguage: 'ko',
  tier: 'fast',
};

const SCHEMA = { type: 'object', title: 'wire' };

function status(claude: Partial<BridgeStatus['targets']['claude']>): BridgeStatus {
  const base = {
    installed: true,
    loggedIn: true,
    authMethod: null,
    subscriptionType: null,
    warnings: [],
  };
  return {
    protocol: 1,
    platform: 'darwin',
    targets: { claude: { ...base, ...claude }, codex: { ...base, installed: false } },
  };
}

function setup(target: CliTarget = 'claude', result?: Partial<BridgeAnalyzeResult>) {
  const client = {
    analyze: vi.fn<BridgeClient['analyze']>().mockResolvedValue({
      output: WIRE as unknown as Record<string, unknown>,
      model: 'claude-sonnet-5',
      usage: { inputTokens: 7149, outputTokens: 1282 },
      ...result,
    }),
    status: vi.fn<BridgeClient['status']>().mockResolvedValue(status({})),
  };
  const buildPrompt = vi.fn(() => ({ system: 'SYSTEM', text: 'USER TEXT' }));
  const provider = createCliProvider({
    getTarget: () => target,
    buildPrompt,
    schema: SCHEMA,
    client,
  });
  return { provider, client, buildPrompt };
}

describe('createCliProvider', () => {
  it('is the cli provider with CLI-alias defaults per target', () => {
    expect(setup('claude').provider.id).toBe('cli');
    expect(setup('claude').provider.defaultModel('fast')).toBe('sonnet');
    expect(setup('claude').provider.defaultModel('accurate')).toBe('sonnet');
    expect(setup('codex').provider.defaultModel('fast')).toBe('');
  });

  it('sends the engine prompt, schema and bare images to the bridge', async () => {
    const { provider, client, buildPrompt } = setup();
    const controller = new AbortController();
    const raw = await provider.extract(REQ, {
      apiKey: '',
      model: 'opus',
      signal: controller.signal,
    });

    expect(buildPrompt).toHaveBeenCalledWith(REQ);
    expect(client.analyze).toHaveBeenCalledWith(
      {
        target: 'claude',
        model: 'opus',
        system: 'SYSTEM',
        text: 'USER TEXT',
        images: [{ mimeType: 'image/jpeg', base64: '/9j/' }],
        schema: SCHEMA,
      },
      controller.signal
    );
    expect(raw).toEqual({
      wire: WIRE,
      model: 'claude-sonnet-5',
      inputTokens: 7149,
      outputTokens: 1282,
    });
  });

  it('falls back to the default model and the request signal', async () => {
    const { provider, client } = setup('codex', { model: null, usage: null });
    const controller = new AbortController();
    const raw = await provider.extract({ ...REQ, signal: controller.signal }, {
      apiKey: '',
      model: '',
    });
    expect(client.analyze.mock.calls[0]?.[0]).toMatchObject({ target: 'codex', model: '' });
    expect(client.analyze.mock.calls[0]?.[1]).toBe(controller.signal);
    expect(raw).toEqual({ wire: WIRE, model: 'codex-default' });
  });

  it('rejects output that does not match WireExtraction', async () => {
    const { provider } = setup('claude', { output: { items: 'none' } });
    const error = await provider.extract(REQ, { apiKey: '', model: '' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AIError);
    expect(error).toMatchObject({ code: 'bad_response', message: 'cli_bad_output', provider: 'cli' });
  });

  it('propagates bridge errors unchanged', async () => {
    const { provider, client } = setup();
    const failure = new AIError('auth', 'cli_not_logged_in', 'cli');
    client.analyze.mockRejectedValue(failure);
    await expect(provider.extract(REQ, { apiKey: '', model: '' })).rejects.toBe(failure);
  });

  it('testConnection checks the selected CLI is installed and logged in', async () => {
    const { provider, client } = setup();
    await expect(provider.testConnection({ apiKey: '', model: '' })).resolves.toBeUndefined();

    client.status.mockResolvedValue(status({ loggedIn: false }));
    await expect(provider.testConnection({ apiKey: '', model: '' })).rejects.toMatchObject({
      code: 'auth',
      message: 'cli_not_logged_in',
    });

    client.status.mockResolvedValue(status({ installed: false, loggedIn: false }));
    await expect(provider.testConnection({ apiKey: '', model: '' })).rejects.toMatchObject({
      code: 'not_configured',
      message: 'cli_not_installed',
    });

    const codex = setup('codex');
    await expect(codex.provider.testConnection({ apiKey: '', model: '' })).rejects.toMatchObject({
      message: 'cli_not_installed',
    });
  });
});

describe('isWireExtraction', () => {
  it('accepts the wire format', () => {
    expect(isWireExtraction(WIRE)).toBe(true);
    expect(isWireExtraction({ ...WIRE, items: [] })).toBe(true);
  });

  it('rejects structural mismatches', () => {
    const item = WIRE.items[0];
    for (const bad of [
      null,
      [],
      { ...WIRE, booth: null },
      { ...WIRE, booth: { ...WIRE.booth, mailOrder: 'no' } },
      { ...WIRE, currency: 5 },
      { ...WIRE, items: {} },
      { ...WIRE, items: [{ ...item, price: '1500' }] },
      { ...WIRE, items: [{ ...item, price: Number.NaN }] },
      { ...WIRE, items: [{ ...item, cat: 'weapon' }] },
      { ...WIRE, items: [{ ...item, opts: [1] }] },
      { ...WIRE, items: [{ ...item, name: null }] },
    ]) {
      expect(isWireExtraction(bad)).toBe(false);
    }
  });
});
