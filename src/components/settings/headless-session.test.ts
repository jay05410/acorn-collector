import { describe, expect, it, vi } from 'vitest';
import { AIError } from '@/lib/ai/types';
import {
  clearPendingFlow,
  completePendingFlow,
  HEADLESS_FLOW_KEY,
  HEADLESS_FLOW_MAX_AGE_MS,
  loadPendingFlow,
  savePendingFlow,
  type PendingHeadlessFlow,
} from './headless-session';

/** chrome.storage.session stand-in that survives a "panel reload". */
function sessionArea(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: vi.fn(async (key: string) => (data.has(key) ? { [key]: data.get(key) } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    }),
    remove: vi.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

type Area = Parameters<typeof loadPendingFlow>[1];

const NOW = Date.UTC(2026, 8, 29, 12);
const FLOW: PendingHeadlessFlow = {
  authUrl: 'https://openrouter.ai/auth?code_challenge=abc&code_challenge_method=S256',
  verifier: 'v'.repeat(43),
  createdAt: NOW,
};

describe('pending OpenRouter code flow', () => {
  it('keeps the verifier across a reload', async () => {
    const area = sessionArea();
    await savePendingFlow(FLOW, area as unknown as Area);
    // A reloaded panel reads the same session storage.
    expect(await loadPendingFlow(NOW + 60_000, area as unknown as Area)).toEqual(FLOW);
  });

  it('returns null when nothing is saved', async () => {
    expect(await loadPendingFlow(NOW, sessionArea() as unknown as Area)).toBeNull();
  });

  it('drops a stale flow', async () => {
    const area = sessionArea({ [HEADLESS_FLOW_KEY]: FLOW });
    const later = NOW + HEADLESS_FLOW_MAX_AGE_MS + 1;
    expect(await loadPendingFlow(later, area as unknown as Area)).toBeNull();
    expect(area.data.has(HEADLESS_FLOW_KEY)).toBe(false);
  });

  it('drops malformed or non-https entries', async () => {
    for (const bad of [
      { ...FLOW, verifier: '' },
      { ...FLOW, authUrl: 'http://openrouter.ai/auth' },
      { ...FLOW, createdAt: 'yesterday' },
      'garbage',
    ]) {
      const area = sessionArea({ [HEADLESS_FLOW_KEY]: bad });
      expect(await loadPendingFlow(NOW, area as unknown as Area)).toBeNull();
      expect(area.data.has(HEADLESS_FLOW_KEY)).toBe(false);
    }
  });

  it('clears the flow', async () => {
    const area = sessionArea({ [HEADLESS_FLOW_KEY]: FLOW });
    await clearPendingFlow(area as unknown as Area);
    expect(area.data.size).toBe(0);
  });
});

describe('completePendingFlow', () => {
  it('exchanges a pasted code, or a pasted URL, with the saved verifier', async () => {
    const exchange = vi.fn(async () => ({ key: 'sk-or-new', userId: 'u1' }));
    await expect(completePendingFlow(FLOW, '  abc123  ', undefined, exchange)).resolves.toEqual({
      key: 'sk-or-new',
      userId: 'u1',
    });
    expect(exchange).toHaveBeenLastCalledWith({
      code: 'abc123',
      verifier: FLOW.verifier,
      signal: undefined,
    });
    await completePendingFlow(FLOW, 'https://example.test/cb?code=xyz%2D9&state=1', undefined, exchange);
    expect(exchange).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'xyz-9' }));
  });

  it('rejects text that holds no code without calling OpenRouter', async () => {
    const exchange = vi.fn();
    await expect(completePendingFlow(FLOW, 'not a code!', undefined, exchange)).rejects.toSatisfy(
      (error: unknown) => error instanceof AIError && error.code === 'auth'
    );
    expect(exchange).not.toHaveBeenCalled();
  });
});
