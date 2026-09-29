// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshot } from '@/lib/capture/snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff } from '@/lib/capture/types';
import { db } from '@/lib/db';
import type { AppSettings } from '@/lib/settings-types';
import { createDefaultSettings } from '@/lib/storage';
import App from './App';

type Listener = (changes: Record<string, chrome.storage.StorageChange>) => void;

const session = new Map<string, unknown>();
const sessionListeners = new Set<Listener>();
const sessionRemove = vi.fn(async (key: string) => {
  session.delete(key);
});
const local = new Map<string, unknown>();

/** Settings of a user who has seen the first-run notice. */
function acceptedSettings(): AppSettings {
  return { ...createDefaultSettings(), language: 'en', noticeAcceptedAt: 1 };
}

function fakeChrome() {
  const area = {
    get: vi.fn(async (key: string) => (local.has(key) ? { [key]: local.get(key) } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) local.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      local.delete(key);
    }),
  };
  const events = { addListener: vi.fn(), removeListener: vi.fn() };
  return {
    runtime: {
      id: 'abcdefghijklmnopabcdefghijklmnop',
      getManifest: () => ({ version: '1.0.0' }),
    },
    windows: { getCurrent: vi.fn(async () => ({ id: 3 })) },
    permissions: {
      contains: vi.fn(async () => false),
      onAdded: events,
      onRemoved: events,
    },
    tabs: { create: vi.fn(async () => ({})) },
    storage: {
      local: area,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      session: {
        get: vi.fn(async (key: string) => (session.has(key) ? { [key]: session.get(key) } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        }),
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

/** Types into a controlled input the way React listens for it. */
function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function inputValues(): string[] {
  return [...document.querySelectorAll('input')].map((input) => input.value);
}

let root: Root;

async function renderApp(settings: AppSettings) {
  local.set('settings', settings);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App initialSettings={settings} />);
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('chrome', fakeChrome());
  // The sponsor feed: nothing to show.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  await renderApp(acceptedSettings());
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
  session.clear();
  sessionListeners.clear();
  local.clear();
  sessionRemove.mockClear();
  vi.unstubAllGlobals();
});

function dialog(): HTMLElement | null {
  return document.querySelector('[role="dialog"]');
}

/** A button on the layer on top (not inside the covered panel). */
function activeButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) =>
      (button.getAttribute('aria-label') ?? button.textContent?.trim()) === label &&
      button.closest('[inert]') === null
  );
}

/** The page title on the layer on top. */
function topTitle(): string | undefined {
  return [...document.querySelectorAll('h1')]
    .find((heading) => heading.closest('[inert]') === null)
    ?.textContent ?? undefined;
}

async function openSettingsFromHeader() {
  await act(async () => activeButton('Settings')?.click());
  expect(topTitle()).toBe('Settings');
}

async function backFromSettings() {
  const back = activeButton('Back');
  expect(back).toBeDefined();
  await act(async () => back?.click());
  expect(document.querySelector('[inert]')).toBeNull();
}

describe('side panel capture review', () => {
  it("opens the review sheet prefilled from this window's capture and keeps the handoff until dismissed", async () => {
    await emit(handoff(3));
    await vi.waitFor(() => expect(inputValues()).toContain('A-12'));
    expect(inputValues()).toEqual(expect.arrayContaining(['A-12', 'Circle Acorn']));
    expect(dialog()?.textContent).toContain('forms.example.org');
    // Opening does not consume the capture: reopening the panel shows it again.
    expect(sessionRemove).not.toHaveBeenCalled();

    const close = dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    await act(async () => close?.click());
    await vi.waitFor(() => expect(sessionRemove).toHaveBeenCalledWith(CAPTURE_HANDOFF_KEY));
    expect(dialog()).toBeNull();
  });

  it('keeps the review sheet and its edits under Settings, then gives them back', async () => {
    await emit(handoff(3));
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Connect AI'));
    const boothNumber = [...document.querySelectorAll('input')].find((input) => input.value === 'A-12');
    type(boothNumber!, 'B-34');
    expect(inputValues()).toContain('B-34');

    const connect = [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Connect AI'
    );
    await act(async () => connect?.click());
    // Settings cover the sheet, which stays mounted but inert.
    expect(topTitle()).toBe('Settings');
    expect(dialog()).not.toBeNull();
    expect(dialog()?.closest('[inert]')).not.toBeNull();
    // The capture is kept while Settings is open.
    expect(sessionRemove).not.toHaveBeenCalled();
    // "Connect AI" opens settings at the AI section.
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe('settings-ai-title')
    );

    await backFromSettings();
    expect(dialog()?.closest('[inert]')).toBeNull();
    expect(inputValues()).toContain('B-34');
    expect(inputValues()).not.toContain('A-12');
    expect(sessionRemove).not.toHaveBeenCalled();
  });

  it('opens a capture that arrives while Settings is open, under Settings', async () => {
    await openSettingsFromHeader();
    await emit(handoff(3));
    await vi.waitFor(() => expect(inputValues()).toContain('A-12'));
    expect(dialog()?.closest('[inert]')).not.toBeNull();
    expect(sessionRemove).not.toHaveBeenCalled();

    await backFromSettings();
    expect(dialog()?.closest('[inert]')).toBeNull();
    expect(inputValues()).toContain('A-12');
    expect(sessionRemove).not.toHaveBeenCalled();
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

describe('side panel settings', () => {
  beforeEach(async () => {
    await db.events.clear();
    await db.booths.clear();
  });

  it('keeps the booth page and its unsaved edit under Settings', async () => {
    const now = Date.now();
    await db.events.put({
      id: 'e1',
      name: 'Comic Acorn',
      date: null,
      location: null,
      mapImageUrl: null,
      currency: null,
      createdAt: now,
      updatedAt: now,
    });
    await db.booths.put({
      id: 'b1',
      eventId: 'e1',
      boothNumber: 'C-07',
      circleName: 'Circle Oak',
      zone: null,
      sourceUrl: null,
      formUrl: null,
      memo: null,
      imageUrls: null,
      sourceText: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });

    const eventToggle = await vi.waitFor(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(
        (el) => el.textContent?.includes('Comic Acorn')
      );
      expect(button).toBeDefined();
      return button!;
    });
    await act(async () => eventToggle.click());
    const boothRow = await vi.waitFor(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (el) => el.textContent?.includes('Circle Oak') && !el.hasAttribute('aria-expanded')
      );
      expect(button).toBeDefined();
      return button!;
    });
    await act(async () => boothRow.click());
    await vi.waitFor(() => expect(activeButton('Edit')).toBeDefined());
    await act(async () => activeButton('Edit')?.click());
    const circleName = [...document.querySelectorAll('input')].find(
      (input) => input.value === 'Circle Oak'
    );
    type(circleName!, 'Circle Oak (unsaved)');

    await openSettingsFromHeader();
    // Settings open at the top, not at a section.
    expect(document.activeElement?.tagName).toBe('H1');
    expect(document.querySelector('main')?.closest('[inert]')).not.toBeNull();

    await backFromSettings();
    expect(inputValues()).toContain('Circle Oak (unsaved)');
  });
});

describe('side panel appearance', () => {
  function option(value: string): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>(
      `input[type="radio"][value="${value}"]`
    );
    if (!input) throw new Error(`No option ${value}`);
    return input;
  }

  async function settle() {
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('applies a language or theme before it is saved, and undoes one that cannot be saved', async () => {
    await openSettingsFromHeader();

    // Applied in the same update as the click, before storage answers.
    act(() => option('sky').click());
    expect(document.documentElement.getAttribute('data-theme')).toBe('sky');
    act(() => option('ko').click());
    expect(topTitle()).toBe('설정');
    expect(document.documentElement.lang).toBe('ko-KR');
    await settle();
    expect(local.get('settings')).toMatchObject({ language: 'ko', colorTheme: 'sky' });

    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('quota'));
    act(() => option('ja').click());
    expect(topTitle()).toBe('設定');
    await settle();
    expect(topTitle()).toBe('설정');
    expect(local.get('settings')).toMatchObject({ language: 'ko' });
  });
});

describe('side panel first run', () => {
  it('shows the first-run notice until it is accepted', async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    await renderApp({ ...acceptedSettings(), noticeAcceptedAt: null });
    await vi.waitFor(() =>
      expect(dialog()?.textContent).toContain('Welcome to Acorn Collector')
    );

    await act(async () => activeButton('Get started')?.click());
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect((local.get('settings') as AppSettings).noticeAcceptedAt).toEqual(
      expect.any(Number)
    );
  });
});
