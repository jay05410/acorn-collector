import { describe, expect, it, vi } from 'vitest';
import {
  consumeCaptureHandoff,
  freshHandoff,
  HANDOFF_MAX_AGE_MS,
  type HandoffStore,
  isCaptureHandoff,
  isForWindow,
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

/** Session storage fake for a side panel in window 3 (null: unknown window). */
function store(initial: unknown, windowId: number | null = 3) {
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
    const oldValue = data.get(CAPTURE_HANDOFF_KEY);
    data.set(CAPTURE_HANDOFF_KEY, value);
    for (const listener of listeners) {
      listener({ [CAPTURE_HANDOFF_KEY]: { oldValue, newValue: value } });
    }
  };
  const handoffStore = {
    session,
    now: () => NOW,
    windowId: async () => windowId,
  } as unknown as HandoffStore;
  return { handoffStore, session, emit, data, listeners };
}

describe('isCaptureHandoff / freshHandoff', () => {
  it('validates the shape', () => {
    expect(isCaptureHandoff(handoff())).toBe(true);
    expect(isCaptureHandoff({ ...handoff(), trigger: 'bogus' })).toBe(false);
    expect(isCaptureHandoff({ ...handoff(), snapshot: {} })).toBe(false);
    expect(isCaptureHandoff(undefined)).toBe(false);
    expect(isCaptureHandoff(handoff({ windowId: 3 }))).toBe(true);
    expect(isCaptureHandoff(handoff({ windowId: null }))).toBe(true);
    expect(isCaptureHandoff({ ...handoff(), windowId: '3' })).toBe(false);
  });

  it('matches windows, treating unstamped handoffs and unknown panels as any window', () => {
    expect(isForWindow(handoff({ windowId: 3 }), 3)).toBe(true);
    expect(isForWindow(handoff({ windowId: 4 }), 3)).toBe(false);
    expect(isForWindow(handoff(), 3)).toBe(true);
    expect(isForWindow(handoff({ windowId: null }), 3)).toBe(true);
    expect(isForWindow(handoff({ windowId: 4 }), null)).toBe(true);
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
    await vi.waitFor(() => expect(received[1]?.id).toBe('h2'));
    emit(undefined);
    await vi.waitFor(() => expect(received).toHaveLength(3));
    expect(received[2]).toBeNull();

    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("ignores other windows' handoffs, including their removal", async () => {
    const { handoffStore, emit, session } = store(handoff({ id: 'other', windowId: 4 }));
    const received: Array<CaptureHandoff | null> = [];
    subscribeCaptureHandoff((value) => received.push(value), handoffStore);
    await vi.waitFor(() => expect(session.get).toHaveBeenCalled());

    emit(handoff({ id: 'mine', windowId: 3 }));
    await vi.waitFor(() => expect(received).toHaveLength(1));
    // Window 4 captures again (overwriting the shared key), then consumes it.
    emit(handoff({ id: 'other-2', windowId: 4 }));
    emit(undefined);
    emit(handoff({ id: 'unstamped' }));
    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received.map((value) => value?.id)).toEqual(['mine', 'unstamped']);
  });

  it('shows every window its handoff when the panel window is unknown', async () => {
    const { handoffStore } = store(handoff({ id: 'other', windowId: 4 }), null);
    const onHandoff = vi.fn();
    subscribeCaptureHandoff(onHandoff, handoffStore);
    await vi.waitFor(() => expect(onHandoff).toHaveBeenCalledWith(expect.objectContaining({ id: 'other' })));
  });

  it('skips a stale stored handoff', async () => {
    const { handoffStore, session } = store(handoff({ createdAt: NOW - 10 * 60_000 }));
    const onHandoff = vi.fn();
    subscribeCaptureHandoff(onHandoff, handoffStore);
    await vi.waitFor(() => expect(session.get).toHaveBeenCalled());
    // Let the storage read and window lookup settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
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
