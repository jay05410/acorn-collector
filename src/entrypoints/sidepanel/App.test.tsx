// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshot } from '@/lib/capture/snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff } from '@/lib/capture/types';
import { createDefaultSettings } from '@/lib/storage';
import App from './App';

type Listener = (changes: Record<string, chrome.storage.StorageChange>) => void;

const session = new Map<string, unknown>();
const sessionListeners = new Set<Listener>();
const sessionRemove = vi.fn(async (key: string) => {
  session.delete(key);
});

function fakeChrome() {
  const area = { get: vi.fn(async () => ({})), set: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
  return {
    runtime: { getManifest: () => ({ version: '1.0.0' }) },
    windows: { getCurrent: vi.fn(async () => ({ id: 3 })) },
    storage: {
      local: area,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      session: {
        get: vi.fn(async (key: string) => (session.has(key) ? { [key]: session.get(key) } : {})),
        remove: sessionRemove,
        onChanged: {
          addListener: vi.fn((listener: Listener) => sessionListeners.add(listener)),
          removeListener: vi.fn((listener: Listener) => sessionListeners.delete(listener)),
        },
      },
    },
  };
}

function handoff(windowId: number): CaptureHandoff {
  return {
    id: `h-${windowId}`,
    trigger: 'context-menu',
    snapshot: createSnapshot({
      site: 'x',
      url: 'https://x.com/circle/status/1',
      capturedAt: Date.now(),
      text: 'Booth A-12 on both days',
      author: { name: 'Circle Acorn', handle: 'circle', url: null },
      links: ['https://forms.example.org/f1'],
    }),
    focusImageUrl: null,
    createdAt: Date.now(),
    windowId,
  };
}

async function emit(value: CaptureHandoff) {
  const oldValue = session.get(CAPTURE_HANDOFF_KEY);
  session.set(CAPTURE_HANDOFF_KEY, value);
  await act(async () => {
    for (const listener of sessionListeners) {
      listener({ [CAPTURE_HANDOFF_KEY]: { oldValue, newValue: value } });
    }
  });
}

function inputValues(): string[] {
  return [...document.querySelectorAll('input')].map((input) => input.value);
}

let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('chrome', fakeChrome());
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App initialSettings={createDefaultSettings()} />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
  session.clear();
  sessionListeners.clear();
  vi.unstubAllGlobals();
});

describe('side panel capture adapter', () => {
  it("opens the add form prefilled from this window's capture and consumes it", async () => {
    await emit(handoff(3));
    await vi.waitFor(() => expect(inputValues()).toContain('A-12'));
    expect(inputValues()).toEqual(
      expect.arrayContaining(['A-12', 'Circle Acorn', 'https://forms.example.org/f1'])
    );
    await vi.waitFor(() => expect(sessionRemove).toHaveBeenCalledWith(CAPTURE_HANDOFF_KEY));
  });

  it("ignores another window's capture", async () => {
    await emit(handoff(4));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(inputValues()).not.toContain('A-12');
    expect(sessionRemove).not.toHaveBeenCalled();
  });
});
