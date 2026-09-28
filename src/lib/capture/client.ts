/**
 * Side panel side of capture: request a capture of the active tab and
 * receive the background's handoff from chrome.storage.session.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CaptureRequestMessage, CaptureRequestResponse } from './messages';
import { isPageSnapshot } from './snapshot';
import { CAPTURE_HANDOFF_KEY, type CaptureHandoff, type CaptureTrigger } from './types';

/** Handoffs older than this are ignored (e.g. left over from an old panel). */
export const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000;

const TRIGGERS: readonly CaptureTrigger[] = [
  'context-menu',
  'image-context-menu',
  'action',
  'shortcut',
  'panel-button',
];

export function isCaptureHandoff(value: unknown): value is CaptureHandoff {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    TRIGGERS.includes(v.trigger as CaptureTrigger) &&
    isPageSnapshot(v.snapshot) &&
    (v.focusImageUrl === null || typeof v.focusImageUrl === 'string') &&
    typeof v.createdAt === 'number'
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
}

function defaultStore(): HandoffStore {
  return { session: chrome.storage.session, now: Date.now };
}

/**
 * Call `onHandoff` with the current fresh handoff (if any) and with every
 * later one. Returns an unsubscribe function.
 */
export function subscribeCaptureHandoff(
  onHandoff: (handoff: CaptureHandoff | null) => void,
  store: HandoffStore = defaultStore()
): () => void {
  let active = true;
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    const change = changes[CAPTURE_HANDOFF_KEY];
    if (!change) return;
    onHandoff(freshHandoff(change.newValue, store.now()));
  };
  store.session.onChanged.addListener(listener);
  store.session
    .get(CAPTURE_HANDOFF_KEY)
    .then((items) => {
      const handoff = freshHandoff(items[CAPTURE_HANDOFF_KEY], store.now());
      if (active && handoff) onHandoff(handoff);
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
