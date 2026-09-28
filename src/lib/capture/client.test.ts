import { describe, expect, it, vi } from 'vitest';
import {
  consumeCaptureHandoff,
  freshHandoff,
  HANDOFF_MAX_AGE_MS,
  type HandoffStore,
  isCaptureHandoff,
  requestCapture,
  subscribeCaptureHandoff,
} from './client';
import { createSnapshot } from './snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff } from './types';

const NOW = 1_800_000_000_000;

function handoff(overrides: Partial<CaptureHandoff> = {}): CaptureHandoff {
  return {
    id: 'h1',
    trigger: 'context-menu',
    snapshot: createSnapshot({ url: 'https://e.com', capturedAt: NOW }),
    focusImageUrl: null,
    createdAt: NOW,
    ...overrides,
  };
}

type Listener = (changes: Record<string, chrome.storage.StorageChange>) => void;

function store(initial: unknown) {
  const data = new Map<string, unknown>([[CAPTURE_HANDOFF_KEY, initial]]);
  const listeners = new Set<Listener>();
  const session = {
    get: vi.fn(async (key: string) => (data.has(key) ? { [key]: data.get(key) } : {})),
    remove: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    onChanged: {
      addListener: vi.fn((listener: Listener) => listeners.add(listener)),
      removeListener: vi.fn((listener: Listener) => listeners.delete(listener)),
    },
  };
  const emit = (value: unknown) => {
    data.set(CAPTURE_HANDOFF_KEY, value);
    for (const listener of listeners) {
      listener({ [CAPTURE_HANDOFF_KEY]: { newValue: value } });
    }
  };
  const handoffStore = { session, now: () => NOW } as unknown as HandoffStore;
  return { handoffStore, session, emit, data, listeners };
}

describe('isCaptureHandoff / freshHandoff', () => {
  it('validates the shape', () => {
    expect(isCaptureHandoff(handoff())).toBe(true);
    expect(isCaptureHandoff({ ...handoff(), trigger: 'bogus' })).toBe(false);
    expect(isCaptureHandoff({ ...handoff(), snapshot: {} })).toBe(false);
    expect(isCaptureHandoff(undefined)).toBe(false);
  });

  it('ignores handoffs older than two minutes', () => {
    expect(HANDOFF_MAX_AGE_MS).toBe(120_000);
    expect(freshHandoff(handoff({ createdAt: NOW - 119_000 }), NOW)).not.toBeNull();
    expect(freshHandoff(handoff({ createdAt: NOW - 121_000 }), NOW)).toBeNull();
    expect(freshHandoff(handoff({ createdAt: NOW + 5_000 }), NOW)).toBeNull();
  });
});

describe('subscribeCaptureHandoff', () => {
  it('delivers the stored fresh handoff, then later ones, until unsubscribed', async () => {
    const { handoffStore, emit, listeners } = store(handoff());
    const received: Array<CaptureHandoff | null> = [];
    const unsubscribe = subscribeCaptureHandoff((value) => received.push(value), handoffStore);

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]?.id).toBe('h1');

    emit(handoff({ id: 'h2' }));
    expect(received[1]?.id).toBe('h2');
    emit(undefined);
    expect(received[2]).toBeNull();

    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it('skips a stale stored handoff', async () => {
    const { handoffStore, session } = store(handoff({ createdAt: NOW - 10 * 60_000 }));
    const onHandoff = vi.fn();
    subscribeCaptureHandoff(onHandoff, handoffStore);
    await vi.waitFor(() => expect(session.get).toHaveBeenCalled());
    await Promise.resolve();
    expect(onHandoff).not.toHaveBeenCalled();
  });
});

describe('consumeCaptureHandoff', () => {
  it('removes only the handoff that was shown', async () => {
    const { handoffStore, session, data } = store(handoff({ id: 'newer' }));
    await consumeCaptureHandoff('older', handoffStore);
    expect(session.remove).not.toHaveBeenCalled();
    await consumeCaptureHandoff('newer', handoffStore);
    expect(session.remove).toHaveBeenCalledWith(CAPTURE_HANDOFF_KEY);
    expect(data.has(CAPTURE_HANDOFF_KEY)).toBe(false);
  });
});

describe('requestCapture', () => {
  it('asks the background to capture the active tab of this window', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, handoffId: 'h9' }));
    vi.stubGlobal('chrome', {
      windows: { getCurrent: vi.fn(async () => ({ id: 42 })) },
      runtime: { sendMessage },
    });
    try {
      await expect(requestCapture()).resolves.toEqual({ ok: true, handoffId: 'h9' });
      expect(sendMessage).toHaveBeenCalledWith({ type: 'acorn:request-capture', windowId: 42 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
