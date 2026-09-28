import { describe, expect, it, vi } from 'vitest';
import {
  CAPTURE_COMMAND,
  type CaptureChrome,
  CONTENT_SCRIPT_FILE,
  createCaptureController,
  EXTRACTOR_FILE,
  MENU_ADD_ID,
  MENU_IMAGE_ID,
} from './controller';
import type { ReadableResult } from './readable-result';
import { createSnapshot } from './snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff, type PageSnapshot } from './types';

const TAB = { id: 7, windowId: 3, url: 'https://blog.example.com/post', title: 'Post' } as chrome.tabs.Tab;

function pageSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return createSnapshot({
    url: 'https://blog.example.com/post',
    capturedAt: 100,
    title: 'Post',
    text: 'Block text',
    ...overrides,
  });
}

interface MockOptions {
  /** Replies of successive tabs.sendMessage calls; an Error rejects. */
  replies?: Array<unknown>;
  readable?: ReadableResult | null;
  injectError?: Error;
}

function setup(options: MockOptions = {}) {
  const events: string[] = [];
  const session = new Map<string, unknown>();
  const replies = [...(options.replies ?? [])];

  const api = {
    runtime: { id: 'ext-id' },
    sidePanel: {
      open: vi.fn(async () => {
        events.push('sidePanel.open');
      }),
    },
    tabs: {
      query: vi.fn(async () => [TAB]),
      sendMessage: vi.fn(async () => {
        events.push('tabs.sendMessage');
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
      }),
    },
    scripting: {
      executeScript: vi.fn(async (injection: { files: string[] }) => {
        const file = injection.files[0];
        events.push(`executeScript:${file}`);
        if (options.injectError) throw options.injectError;
        return file === EXTRACTOR_FILE ? [{ result: options.readable ?? null }] : [{}];
      }),
    },
    storage: {
      session: {
        set: vi.fn(async (items: Record<string, unknown>) => {
          events.push('storage.session.set');
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        }),
      },
      local: { remove: vi.fn(async () => {}) },
    },
    contextMenus: { create: vi.fn(), removeAll: vi.fn(async () => {}) },
    i18n: { getMessage: vi.fn((key: string) => `msg:${key}`) },
  };
  const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
  const warn = vi.fn();
  const controller = createCaptureController({
    chrome: api as unknown as CaptureChrome,
    fetch: fetchMock,
    now: () => 1_000,
    createId: () => 'handoff-1',
    warn,
  });
  return { api, controller, events, session, fetchMock, warn };
}

const result = (snapshot: PageSnapshot) => ({ type: 'acorn:capture-result', snapshot });

describe('context menu capture', () => {
  it('opens the side panel before any await and writes the handoff to session storage', async () => {
    const { api, controller, events, session } = setup({
      replies: [result(pageSnapshot())],
      readable: {
        title: null,
        text: 'Main article. Block text',
        author: 'Mika',
        published: null,
        image: null,
        lang: 'en',
      },
    });

    const pending = controller.onContextMenuClick(
      { menuItemId: MENU_ADD_ID, frameId: 2, editable: false, pageUrl: TAB.url } as chrome.contextMenus.OnClickData,
      TAB
    );
    // Still inside the synchronous part of the listener (nothing awaited yet):
    // the panel open call went out first.
    expect(api.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
    expect(events[0]).toBe('sidePanel.open');
    expect(events).not.toContain('storage.session.set');

    const handoff = await pending;
    expect(events).toEqual([
      'sidePanel.open',
      'tabs.sendMessage',
      `executeScript:${EXTRACTOR_FILE}`,
      'storage.session.set',
    ]);
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: 'acorn:capture', trigger: 'context-menu', focusImageUrl: null },
      { frameId: 2 }
    );
    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, frameIds: [2] },
      files: [EXTRACTOR_FILE],
    });
    const stored = session.get(CAPTURE_HANDOFF_KEY) as CaptureHandoff;
    expect(stored).toEqual(handoff);
    expect(stored).toMatchObject({
      id: 'handoff-1',
      trigger: 'context-menu',
      focusImageUrl: null,
      createdAt: 1_000,
    });
    expect(stored.snapshot.text).toBe('Main article. Block text');
    expect(stored.snapshot.author?.name).toBe('Mika');
  });

  it('image menu: upgrades the focus image and puts it first', async () => {
    const { controller, session, api } = setup({
      replies: [result(pageSnapshot({ site: 'x', url: 'https://x.com/a', images: [{ url: 'https://e.com/other.jpg' }] }))],
    });
    await controller.onContextMenuClick(
      {
        menuItemId: MENU_IMAGE_ID,
        frameId: 0,
        editable: false,
        pageUrl: 'https://x.com/a',
        srcUrl: 'https://pbs.twimg.com/media/ABC?format=jpg&name=small',
      } as chrome.contextMenus.OnClickData,
      TAB
    );
    const stored = session.get(CAPTURE_HANDOFF_KEY) as CaptureHandoff;
    const focus = 'https://pbs.twimg.com/media/ABC?format=jpg&name=orig';
    expect(stored.trigger).toBe('image-context-menu');
    expect(stored.focusImageUrl).toBe(focus);
    expect(stored.snapshot.images.map((image) => image.url)).toEqual([focus, 'https://e.com/other.jpg']);
    // X has a dedicated extractor: no defuddle injection.
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('injects the content script once when the tab has no receiver', async () => {
    const { api, controller, session } = setup({
      replies: [new Error('Could not establish connection. Receiving end does not exist.'), result(pageSnapshot())],
    });
    await controller.onContextMenuClick(
      { menuItemId: MENU_ADD_ID, editable: false, pageUrl: TAB.url } as chrome.contextMenus.OnClickData,
      TAB
    );
    expect(api.scripting.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 7, frameIds: [0] },
      files: [CONTENT_SCRIPT_FILE],
    });
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(session.has(CAPTURE_HANDOFF_KEY)).toBe(true);
  });

  it('falls back to what the browser reported when the page is not scriptable', async () => {
    const { controller, session, warn } = setup({
      replies: [new Error('no receiver')],
      injectError: new Error('Cannot access contents of the page'),
    });
    await controller.onContextMenuClick(
      {
        menuItemId: MENU_ADD_ID,
        editable: false,
        pageUrl: 'https://store.example.com/p?utm_source=x',
        selectionText: 'Booth F-1',
        linkUrl: 'https://forms.example.org/f1',
      } as chrome.contextMenus.OnClickData,
      TAB
    );
    const stored = session.get(CAPTURE_HANDOFF_KEY) as CaptureHandoff;
    expect(stored.snapshot).toMatchObject({
      url: 'https://store.example.com/p',
      title: 'Post',
      text: 'Booth F-1',
      selection: 'Booth F-1',
      links: ['https://forms.example.org/f1'],
    });
    expect(warn).toHaveBeenCalled();
  });

  it('ignores other menu items', async () => {
    const { api, controller } = setup();
    expect(
      await controller.onContextMenuClick({ menuItemId: 'other', editable: false } as chrome.contextMenus.OnClickData, TAB)
    ).toBeNull();
    expect(api.sidePanel.open).not.toHaveBeenCalled();
  });

  it('a newer capture supersedes a slower older one', async () => {
    const { controller, session, api } = setup();
    let releaseFirst: (value: unknown) => void = () => {};
    api.tabs.sendMessage
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockImplementationOnce(async () => result(pageSnapshot({ site: 'x', url: 'https://x.com/new' })));
    const info = { menuItemId: MENU_ADD_ID, editable: false } as chrome.contextMenus.OnClickData;

    const first = controller.onContextMenuClick(info, TAB);
    const second = controller.onContextMenuClick(info, TAB);
    expect(await second).not.toBeNull();
    releaseFirst(result(pageSnapshot({ site: 'x', url: 'https://x.com/old' })));
    expect(await first).toBeNull();
    expect((session.get(CAPTURE_HANDOFF_KEY) as CaptureHandoff).snapshot.url).toBe('https://x.com/new');
  });
});

describe('keyboard command', () => {
  it('opens the panel synchronously and captures with the shortcut trigger', async () => {
    const { api, controller, events, session } = setup({ replies: [result(pageSnapshot({ site: 'bluesky', url: 'https://bsky.app/' }))] });
    const pending = controller.onCommand(CAPTURE_COMMAND, TAB);
    expect(events[0]).toBe('sidePanel.open');
    expect(api.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
    await pending;
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: 'acorn:capture', trigger: 'shortcut', focusImageUrl: null },
      { frameId: 0 }
    );
    expect((session.get(CAPTURE_HANDOFF_KEY) as CaptureHandoff).trigger).toBe('shortcut');
  });

  it('ignores unknown commands and missing tabs', async () => {
    const { api, controller } = setup();
    expect(await controller.onCommand('other', TAB)).toBeNull();
    expect(await controller.onCommand(CAPTURE_COMMAND, undefined)).toBeNull();
    expect(api.sidePanel.open).not.toHaveBeenCalled();
  });
});

describe('side panel request', () => {
  const extensionPage = { id: 'ext-id' } as chrome.runtime.MessageSender;

  it('captures the active tab of the requested window without opening the panel', async () => {
    const { api, controller } = setup({ replies: [result(pageSnapshot({ site: 'x', url: 'https://x.com/a' }))] });
    const sendResponse = vi.fn();
    const keepOpen = controller.onRuntimeMessage(
      { type: 'acorn:request-capture', windowId: 3 },
      extensionPage,
      sendResponse
    );
    expect(keepOpen).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, handoffId: 'handoff-1' });
    expect(api.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 3 });
    expect(api.sidePanel.open).not.toHaveBeenCalled();
  });

  it('rejects requests from content scripts and unrelated messages', () => {
    const { controller } = setup();
    const sendResponse = vi.fn();
    expect(
      controller.onRuntimeMessage(
        { type: 'acorn:request-capture' },
        { id: 'ext-id', tab: TAB } as chrome.runtime.MessageSender,
        sendResponse
      )
    ).toBe(false);
    expect(controller.onRuntimeMessage({ type: 'other' }, extensionPage, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('reports no-tab and unsupported pages', async () => {
    const { api, controller } = setup({ injectError: new Error('blocked'), replies: [new Error('none')] });
    api.tabs.query.mockResolvedValueOnce([]);
    expect(await controller.onPanelRequest({ type: 'acorn:request-capture' })).toEqual({
      ok: false,
      code: 'no-tab',
    });
    api.tabs.query.mockResolvedValueOnce([{ ...TAB, url: 'chrome://settings' }]);
    expect(await controller.onPanelRequest({ type: 'acorn:request-capture' })).toEqual({
      ok: false,
      code: 'unsupported-page',
    });
  });
});

describe('onInstalled', () => {
  it('recreates both menus with localized titles and clears v1 data on update', async () => {
    const { api, controller } = setup();
    await controller.onInstalled({ reason: 'update' } as chrome.runtime.InstalledDetails);
    expect(api.storage.local.remove).toHaveBeenCalledWith(['auth_state', 'auth_token', 'lastContextTweet']);
    expect(api.contextMenus.removeAll).toHaveBeenCalled();
    expect(api.contextMenus.create).toHaveBeenCalledWith({
      id: MENU_ADD_ID,
      title: 'msg:contextMenuAdd',
      contexts: ['page', 'selection', 'link'],
    });
    expect(api.contextMenus.create).toHaveBeenCalledWith({
      id: MENU_IMAGE_ID,
      title: 'msg:contextMenuAnalyzeImage',
      contexts: ['image'],
    });
  });

  it('does not touch storage on a fresh install', async () => {
    const { api, controller } = setup();
    await controller.onInstalled({ reason: 'install' } as chrome.runtime.InstalledDetails);
    expect(api.storage.local.remove).not.toHaveBeenCalled();
  });
});
