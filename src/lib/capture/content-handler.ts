/**
 * Content-script side of capture: remembers the last right-clicked element
 * (in memory only) and answers `acorn:capture` requests with a snapshot.
 */
import { readSelection, selectionTarget } from './dom';
import { detectSite } from './snapshot';
import { buildBlueskySnapshot } from './sites/bluesky';
import type { CaptureContext } from './sites/context';
import { buildGenericSnapshot } from './sites/generic';
import { buildXSnapshot } from './sites/x';
import type { CaptureMessage, CaptureTrigger, PageSnapshot } from './types';

type CaptureRequest = Extract<CaptureMessage, { type: 'acorn:capture' }>;

const CAPTURE_TRIGGERS: readonly CaptureTrigger[] = [
  'context-menu',
  'image-context-menu',
  'action',
  'shortcut',
  'panel-button',
];

export function isCaptureRequest(message: unknown): message is CaptureRequest {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as { type?: unknown; trigger?: unknown };
  return (
    candidate.type === 'acorn:capture' &&
    CAPTURE_TRIGGERS.includes(candidate.trigger as CaptureTrigger)
  );
}

/** A right-click older than this is not what the menu click refers to. */
const TARGET_MAX_AGE_MS = 60_000;

export interface ContextTargetTracker {
  /** `contextmenu` listener. */
  record(event: Event): void;
  /** The remembered element if it is recent and still in the document. */
  current(): Element | null;
}

export function createContextTargetTracker(
  now: () => number = Date.now
): ContextTargetTracker {
  let last: { element: Element; at: number } | null = null;
  return {
    record(event) {
      // composedPath()[0] is the real target inside open shadow roots.
      const [first] = event.composedPath();
      const target = first instanceof Element ? first : event.target;
      last = target instanceof Element ? { element: target, at: now() } : null;
    },
    current() {
      if (!last) return null;
      const fresh = now() - last.at <= TARGET_MAX_AGE_MS;
      return fresh && last.element.isConnected ? last.element : null;
    },
  };
}

/** Pick the site extractor for `ctx.url`, falling back to the generic one. */
export function buildPageSnapshot(ctx: CaptureContext): PageSnapshot {
  const site = detectSite(ctx.url);
  if (site === 'x') return buildXSnapshot(ctx) ?? buildGenericSnapshot(ctx, site);
  if (site === 'bluesky') {
    return buildBlueskySnapshot(ctx) ?? buildGenericSnapshot(ctx, site);
  }
  return buildGenericSnapshot(ctx, site);
}

export interface CaptureEnvironment {
  window: Window;
  tracker: ContextTargetTracker;
  now: () => number;
}

/**
 * Build the reply for a capture request. Context-menu captures use the
 * right-clicked element; other triggers use the selection, if any.
 */
export function respondToCapture(
  request: CaptureRequest,
  env: CaptureEnvironment
): CaptureMessage {
  try {
    const fromMenu =
      request.trigger === 'context-menu' ||
      request.trigger === 'image-context-menu';
    const target = fromMenu
      ? (env.tracker.current() ?? selectionTarget(env.window))
      : selectionTarget(env.window);
    const snapshot = buildPageSnapshot({
      doc: env.window.document,
      url: env.window.location.href,
      target,
      selection: readSelection(env.window),
      now: env.now(),
    });
    return { type: 'acorn:capture-result', snapshot };
  } catch (error) {
    return {
      type: 'acorn:capture-error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
