/**
 * Background capture flow (wired up by entrypoints/background.ts).
 *
 * 1. Open the side panel synchronously, while the user gesture is live.
 * 2. Ask the tab's content script for a snapshot (injecting it if the tab
 *    predates the extension), frame-aware for context menu clicks.
 * 3. Pages without a dedicated extractor get the defuddle extractor injected.
 * 4. Enrich from better sources (original X text, Bluesky API, BOOTH JSON).
 * 5. Hand off through chrome.storage.session (memory only).
 */
import { enrichSnapshot } from './enrich';
import type { FetchFn } from './enrich/http';
import { upgradeImageUrl } from './images';
import {
  type CaptureRequestMessage,
  type CaptureRequestResponse,
  isCaptureRequestMessage,
} from './messages';
import { isReadableResult, mergeReadable, type ReadableResult } from './readable-result';
import { cleanUrl, createSnapshot, isPageSnapshot, withLeadingImages } from './snapshot';
import {
  CAPTURE_HANDOFF_KEY,
  type CaptureHandoff,
  type CaptureMessage,
  type CaptureTrigger,
  type PageSnapshot,
  type SiteId,
} from './types';

export const MENU_ADD_ID = 'acorn-add';
export const MENU_IMAGE_ID = 'acorn-analyze-image';
export const CAPTURE_COMMAND = 'capture-page';
/** WXT build output paths. */
export const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
export const EXTRACTOR_FILE = 'extractor.js';

/** v1 keys: removed account data and the per-right-click tweet cache. */
const LEGACY_LOCAL_KEYS = ['auth_state', 'auth_token', 'lastContextTweet'];

/** Sites whose content-script extractor and API enrichment beat defuddle. */
const DEDICATED_SITES: ReadonlySet<SiteId> = new Set(['x', 'bluesky']);

export interface CaptureChrome {
  runtime: Pick<typeof chrome.runtime, 'id'>;
  sidePanel: Pick<typeof chrome.sidePanel, 'open'>;
  tabs: Pick<typeof chrome.tabs, 'query' | 'sendMessage'>;
  scripting: Pick<typeof chrome.scripting, 'executeScript'>;
  storage: {
    session: Pick<chrome.storage.StorageArea, 'set'>;
    local: Pick<chrome.storage.StorageArea, 'remove'>;
  };
  contextMenus: Pick<typeof chrome.contextMenus, 'create' | 'removeAll'>;
  i18n: Pick<typeof chrome.i18n, 'getMessage'>;
}

export interface CaptureControllerDeps {
  chrome: CaptureChrome;
  fetch: FetchFn;
  now?: () => number;
  createId?: () => string;
  warn?: (message: string, error?: unknown) => void;
}

interface CaptureJob {
  tabId: number;
  frameId: number;
  trigger: CaptureTrigger;
  focusImageUrl: string | null;
  /** What the browser told us, for pages the content script cannot read. */
  fallback: {
    url: string | null;
    title: string | null;
    selection: string | null;
    link: string | null;
  };
}

function httpUrl(url: string | undefined): string | null {
  return url ? cleanUrl(url) : null;
}

export function createCaptureController(deps: CaptureControllerDeps) {
  const api = deps.chrome;
  const now = deps.now ?? Date.now;
  const createId = deps.createId ?? (() => crypto.randomUUID());
  const warn = deps.warn ?? ((message: string, error?: unknown) => console.warn(message, error));
  let latestJob = 0;

  /** Must run before any await: sidePanel.open needs the user gesture. */
  function openPanel(windowId: number): void {
    const failed = (error: unknown) => warn('[acorn] side panel did not open', error);
    try {
      api.sidePanel.open({ windowId }).catch(failed);
    } catch (error) {
      failed(error);
    }
  }

  function parseReply(reply: unknown): PageSnapshot | null {
    const message = reply as CaptureMessage | undefined;
    if (message?.type === 'acorn:capture-result' && isPageSnapshot(message.snapshot)) {
      return message.snapshot;
    }
    if (message?.type === 'acorn:capture-error') {
      warn(`[acorn] content script failed: ${message.message}`);
    }
    return null;
  }

  async function askContentScript(job: CaptureJob): Promise<unknown> {
    const request: CaptureMessage = {
      type: 'acorn:capture',
      trigger: job.trigger,
      focusImageUrl: job.focusImageUrl,
    };
    return api.tabs.sendMessage(job.tabId, request, { frameId: job.frameId });
  }

  async function requestSnapshot(job: CaptureJob): Promise<PageSnapshot | null> {
    try {
      return parseReply(await askContentScript(job));
    } catch {
      // No receiver: the tab was open before install/update, or the frame
      // has no content script. Inject it once and retry.
    }
    try {
      await api.scripting.executeScript({
        target: { tabId: job.tabId, frameIds: [job.frameId] },
        files: [CONTENT_SCRIPT_FILE],
      });
      return parseReply(await askContentScript(job));
    } catch (error) {
      warn('[acorn] page is not scriptable', error);
      return null;
    }
  }

  async function runExtractor(job: CaptureJob): Promise<ReadableResult | null> {
    try {
      const [first] = await api.scripting.executeScript({
        target: { tabId: job.tabId, frameIds: [job.frameId] },
        files: [EXTRACTOR_FILE],
      });
      return isReadableResult(first?.result) ? first.result : null;
    } catch (error) {
      warn('[acorn] readability extractor failed', error);
      return null;
    }
  }

  function fallbackSnapshot(job: CaptureJob): PageSnapshot | null {
    const { url, title, selection, link } = job.fallback;
    if (!url) return null;
    return createSnapshot({
      url,
      capturedAt: now(),
      title: title ?? '',
      text: selection ?? '',
      selection,
      links: link ? [link] : [],
    });
  }

  async function buildSnapshot(job: CaptureJob): Promise<PageSnapshot | null> {
    const fromPage = await requestSnapshot(job);
    let snapshot = fromPage ?? fallbackSnapshot(job);
    if (!snapshot) return null;
    if (fromPage && !DEDICATED_SITES.has(snapshot.site)) {
      const readable = await runExtractor(job);
      if (readable) snapshot = mergeReadable(snapshot, readable);
    }
    snapshot = await enrichSnapshot(snapshot, { fetch: deps.fetch });
    return job.focusImageUrl
      ? withLeadingImages(snapshot, [{ url: job.focusImageUrl }])
      : snapshot;
  }

  /**
   * Resolves to the handoff, or null if nothing was captured, a newer
   * capture superseded this one, or the handoff could not be stored.
   * Never rejects.
   */
  async function capture(job: CaptureJob): Promise<CaptureHandoff | null> {
    const jobNumber = ++latestJob;
    try {
      const snapshot = await buildSnapshot(job);
      if (!snapshot || jobNumber !== latestJob) return null;
      const handoff: CaptureHandoff = {
        id: createId(),
        trigger: job.trigger,
        snapshot,
        focusImageUrl: job.focusImageUrl,
        createdAt: now(),
      };
      await api.storage.session.set({ [CAPTURE_HANDOFF_KEY]: handoff });
      return handoff;
    } catch (error) {
      warn('[acorn] capture failed', error);
      return null;
    }
  }

  function jobForTab(
    tab: chrome.tabs.Tab,
    trigger: CaptureTrigger,
    extra: Partial<Pick<CaptureJob, 'frameId' | 'focusImageUrl'>> & {
      fallback?: Partial<CaptureJob['fallback']>;
    } = {}
  ): CaptureJob | null {
    if (tab.id === undefined || tab.id < 0) return null;
    return {
      tabId: tab.id,
      frameId: extra.frameId ?? 0,
      trigger,
      focusImageUrl: extra.focusImageUrl ?? null,
      fallback: {
        url: httpUrl(tab.url),
        title: tab.title ?? null,
        selection: null,
        link: null,
        ...extra.fallback,
      },
    };
  }

  function onContextMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab | undefined
  ): Promise<CaptureHandoff | null> {
    const isImage = info.menuItemId === MENU_IMAGE_ID;
    if (!tab || (!isImage && info.menuItemId !== MENU_ADD_ID)) {
      return Promise.resolve(null);
    }
    openPanel(tab.windowId);
    const focusImageUrl = isImage ? httpUrl(info.srcUrl) : null;
    const job = jobForTab(tab, isImage ? 'image-context-menu' : 'context-menu', {
      frameId: info.frameId ?? 0,
      focusImageUrl: focusImageUrl ? upgradeImageUrl(focusImageUrl) : null,
      fallback: {
        url: httpUrl(info.frameUrl) ?? httpUrl(info.pageUrl) ?? httpUrl(tab.url),
        selection: info.selectionText ?? null,
        link: httpUrl(info.linkUrl),
      },
    });
    return job ? capture(job) : Promise.resolve(null);
  }

  function onCommand(
    command: string,
    tab: chrome.tabs.Tab | undefined
  ): Promise<CaptureHandoff | null> {
    if (command !== CAPTURE_COMMAND || !tab) return Promise.resolve(null);
    openPanel(tab.windowId);
    const job = jobForTab(tab, 'shortcut');
    return job ? capture(job) : Promise.resolve(null);
  }

  /** The panel is already open, so no sidePanel.open here. */
  async function onPanelRequest(
    message: CaptureRequestMessage
  ): Promise<CaptureRequestResponse> {
    const [tab] = await api.tabs.query(
      message.windowId === undefined
        ? { active: true, lastFocusedWindow: true }
        : { active: true, windowId: message.windowId }
    );
    const job = tab ? jobForTab(tab, 'panel-button') : null;
    if (!job) return { ok: false, code: 'no-tab' };
    const jobNumber = latestJob + 1;
    const handoff = await capture(job);
    if (handoff) return { ok: true, handoffId: handoff.id };
    return { ok: false, code: jobNumber === latestJob ? 'unsupported-page' : 'superseded' };
  }

  /**
   * runtime.onMessage listener. Only extension pages (no sender.tab) may
   * request captures. Returns true while a response is pending.
   */
  function onRuntimeMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: CaptureRequestResponse) => void
  ): boolean {
    if (!isCaptureRequestMessage(message)) return false;
    if (sender.id !== api.runtime.id || sender.tab) return false;
    onPanelRequest(message)
      .catch((error: unknown): CaptureRequestResponse => {
        warn('[acorn] capture request failed', error);
        return { ok: false, code: 'unsupported-page' };
      })
      .then(sendResponse);
    return true;
  }

  async function onInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
    if (details.reason === 'update') {
      await api.storage.local.remove(LEGACY_LOCAL_KEYS).catch((error: unknown) => {
        warn('[acorn] could not clear legacy data', error);
      });
    }
    await api.contextMenus.removeAll();
    api.contextMenus.create({
      id: MENU_ADD_ID,
      title: api.i18n.getMessage('contextMenuAdd'),
      contexts: ['page', 'selection', 'link'],
    });
    api.contextMenus.create({
      id: MENU_IMAGE_ID,
      title: api.i18n.getMessage('contextMenuAnalyzeImage'),
      contexts: ['image'],
    });
  }

  return { onContextMenuClick, onCommand, onRuntimeMessage, onPanelRequest, onInstalled };
}

export type CaptureController = ReturnType<typeof createCaptureController>;
