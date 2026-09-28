/**
 * Side panel side of capture: request a capture of the active tab and
 * receive the background's handoff from chrome.storage.session.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CaptureRequestMessage, CaptureRequestResponse } from './messages';
import { isPageSnapshot } from './snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff } from './types';
import { isCaptureTrigger, isNullableString, isRecord } from './util';

/** Handoffs older than this are ignored (e.g. left over from an old panel). */
export const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000;

export function isCaptureHandoff(value: unknown): value is CaptureHandoff {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isCaptureTrigger(value.trigger) &&
    isPageSnapshot(value.snapshot) &&
    isNullableString(value.focusImageUrl) &&
    typeof value.createdAt === 'number' &&
    (value.windowId === undefined ||
      value.windowId === null ||
      typeof value.windowId === 'number')
  );
}

/**
 * Whether a side panel in `windowId` should show `handoff`. Unstamped
 * handoffs, and panels that could not learn their window, match any window.
 */
export function isForWindow(handoff: CaptureHandoff, windowId: number | null): boolean {
  return (
    handoff.windowId === undefined ||
    handoff.windowId === null ||
    windowId === null ||
    handoff.windowId === windowId
  );
}

/** The stored value as a handoff if it is valid and not stale. */
export function freshHandoff(value: unknown, now: number): CaptureHandoff | null {
  if (!isCaptureHandoff(value)) return null;
  const age = now - value.createdAt;
  return age >= 0 && age <= HANDOFF_MAX_AGE_MS ? value : null;
}

type SessionArea = Pick<chrome.storage.SessionStorageArea, 'get' | 'remove' | 'onChanged'>;

export interface HandoffStore {
  session: SessionArea;
  now: () => number;
  /** Window of this side panel, or null if unknown. */
  windowId: () => Promise<number | null>;
}

async function currentWindowId(): Promise<number | null> {
  const current = await chrome.windows.getCurrent();
  return current.id ?? null;
}

function defaultStore(): HandoffStore {
  return { session: chrome.storage.session, now: Date.now, windowId: currentWindowId };
}

/**
 * Call `onHandoff` with the current fresh handoff for this panel's window
 * (if any), with every later one, and with null when this window's handoff
 * is removed. Handoffs for other windows are ignored. Returns an unsubscribe
 * function.
 *
 * All windows share one storage key, so if two windows finish a capture at
 * nearly the same moment, a panel that is still opening can find the other
 * window's handoff in storage and miss its own (last writer wins).
 */
export function subscribeCaptureHandoff(
  onHandoff: (handoff: CaptureHandoff | null) => void,
  store: HandoffStore = defaultStore()
): () => void {
  let active = true;
  let delivered = false;
  const ownWindow = store.windowId().catch(() => null);
  const ours = (value: unknown, windowId: number | null): value is CaptureHandoff =>
    isCaptureHandoff(value) && isForWindow(value, windowId);

  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    const change = changes[CAPTURE_HANDOFF_KEY];
    if (!change) return;
    void ownWindow.then((windowId) => {
      if (!active) return;
      const handoff = ours(change.newValue, windowId)
        ? freshHandoff(change.newValue, store.now())
        : null;
      if (handoff) {
        delivered = true;
        onHandoff(handoff);
      } else if (change.newValue === undefined && ours(change.oldValue, windowId)) {
        onHandoff(null);
      }
    });
  };
  store.session.onChanged.addListener(listener);
  Promise.all([store.session.get(CAPTURE_HANDOFF_KEY), ownWindow])
    .then(([items, windowId]) => {
      const value = items[CAPTURE_HANDOFF_KEY];
      const handoff = ours(value, windowId) ? freshHandoff(value, store.now()) : null;
      // A change delivered meanwhile is newer than this read.
      if (active && handoff && !delivered) onHandoff(handoff);
    })
    .catch((error: unknown) => {
      console.warn('[acorn] could not read capture handoff', error);
    });
  return () => {
    active = false;
    store.session.onChanged.removeListener(listener);
  };
}

/** Remove the stored handoff if it is still the one with `id`. */
export async function consumeCaptureHandoff(
  id: string,
  store: HandoffStore = defaultStore()
): Promise<void> {
  const items = await store.session.get(CAPTURE_HANDOFF_KEY);
  const stored = items[CAPTURE_HANDOFF_KEY];
  if (isCaptureHandoff(stored) && stored.id === id) {
    await store.session.remove(CAPTURE_HANDOFF_KEY);
  }
}

/**
 * Ask the background to capture the active tab of this window. The snapshot
 * arrives through the handoff (useCaptureHandoff); the response only says
 * whether one was written.
 */
export async function requestCapture(): Promise<CaptureRequestResponse> {
  const window = await chrome.windows.getCurrent();
  const message: CaptureRequestMessage = {
    type: 'acorn:request-capture',
    windowId: window.id,
  };
  return chrome.runtime.sendMessage<CaptureRequestMessage, CaptureRequestResponse>(message);
}

/**
 * Latest capture handoff for the side panel. `consume()` clears it (call it
 * once the capture has been shown or saved) so it is not shown again.
 */
export function useCaptureHandoff(): {
  handoff: CaptureHandoff | null;
  consume: () => Promise<void>;
} {
  const [handoff, setHandoff] = useState<CaptureHandoff | null>(null);

  useEffect(() => subscribeCaptureHandoff(setHandoff), []);

  const consume = useCallback(async () => {
    if (!handoff) return;
    setHandoff(null);
    await consumeCaptureHandoff(handoff.id);
  }, [handoff]);

  return { handoff, consume };
}
