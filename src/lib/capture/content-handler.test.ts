// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPageSnapshot,
  createContextTargetTracker,
  isCaptureRequest,
  respondToCapture,
} from './content-handler';

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('isCaptureRequest', () => {
  it('accepts only well-formed capture requests', () => {
    expect(isCaptureRequest({ type: 'acorn:capture', trigger: 'shortcut' })).toBe(true);
    expect(isCaptureRequest({ type: 'acorn:capture', trigger: 'nope' })).toBe(false);
    expect(isCaptureRequest({ type: 'other' })).toBe(false);
    expect(isCaptureRequest(null)).toBe(false);
  });
});

describe('createContextTargetTracker', () => {
  it('remembers the last right-clicked element while it is fresh and attached', () => {
    let now = 0;
    const tracker = createContextTargetTracker(() => now);
    document.body.innerHTML = '<p id="a">a</p>';
    const element = document.getElementById('a') as HTMLElement;
    document.addEventListener('contextmenu', tracker.record);
    element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true }));
    document.removeEventListener('contextmenu', tracker.record);

    expect(tracker.current()).toBe(element);
    now = 61_000;
    expect(tracker.current()).toBeNull();
    now = 0;
    element.remove();
    expect(tracker.current()).toBeNull();
  });
});

describe('buildPageSnapshot', () => {
  it('falls back to the generic extractor on X pages without posts', () => {
    document.title = 'Settings / X';
    const snapshot = buildPageSnapshot({
      doc: document,
      url: 'https://x.com/settings',
      target: null,
      selection: null,
      now: 1,
    });
    expect(snapshot.site).toBe('x');
    expect(snapshot.title).toBe('Settings / X');
  });
});

describe('respondToCapture', () => {
  it('uses the remembered target for context-menu captures', () => {
    document.body.innerHTML =
      '<article id="a"><p id="p">Booth A-1 details are here, come and visit us.</p></article><article id="b"><p>Other</p></article>';
    const target = document.getElementById('p');
    const reply = respondToCapture(
      { type: 'acorn:capture', trigger: 'context-menu' },
      { window, tracker: { record: () => {}, current: () => target }, now: () => 7 }
    );
    expect(reply.type).toBe('acorn:capture-result');
    if (reply.type !== 'acorn:capture-result') return;
    expect(reply.snapshot.text).toContain('Booth A-1');
    expect(reply.snapshot.capturedAt).toBe(7);
  });

  it('ignores the remembered target for shortcut captures', () => {
    document.body.innerHTML = '<article><p id="p">Remembered block with plenty of text in it.</p></article>';
    const target = document.getElementById('p');
    const reply = respondToCapture(
      { type: 'acorn:capture', trigger: 'shortcut' },
      { window, tracker: { record: () => {}, current: () => target }, now: () => 7 }
    );
    expect(reply.type === 'acorn:capture-result' && reply.snapshot.text).toBe('');
  });

  it('reports extractor errors instead of throwing', () => {
    const reply = respondToCapture(
      { type: 'acorn:capture', trigger: 'context-menu' },
      {
        window,
        tracker: {
          record: () => {},
          current: () => {
            throw new Error('boom');
          },
        },
        now: () => 1,
      }
    );
    expect(reply).toEqual({ type: 'acorn:capture-error', message: 'boom' });
  });
});
