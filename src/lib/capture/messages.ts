/**
 * Side panel -> background capture request. (The content-script protocol is
 * the frozen CaptureMessage union in ./types.)
 */

export interface CaptureRequestMessage {
  type: 'acorn:request-capture';
  /** Window whose active tab should be captured (the side panel's window). */
  windowId?: number;
}

export type CaptureRequestFailure =
  /** No capturable active tab in that window. */
  | 'no-tab'
  /** Nothing could be read (browser pages, blocked frames). */
  | 'unsupported-page'
  /** A newer capture started before this one finished. */
  | 'superseded';

export type CaptureRequestResponse =
  | { ok: true; handoffId: string }
  | { ok: false; code: CaptureRequestFailure };

export function isCaptureRequestMessage(value: unknown): value is CaptureRequestMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; windowId?: unknown };
  return (
    candidate.type === 'acorn:request-capture' &&
    (candidate.windowId === undefined || typeof candidate.windowId === 'number')
  );
}
