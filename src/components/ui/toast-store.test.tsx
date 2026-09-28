// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TOASTS,
  clearToasts,
  dismissToast,
  getToasts,
  pauseToast,
  resumeToast,
  runToastAction,
  showToast,
  subscribeToasts,
} from './toast-store';
import { ToastViewport } from './ToastViewport';
import { byText, cleanup, click, render } from './test-utils';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => clearToasts());
  cleanup();
  vi.useRealTimers();
});

describe('toast store', () => {
  it('adds a toast with defaults and returns its id', () => {
    const id = showToast({ message: 'Saved' });
    expect(getToasts()).toEqual([
      { id, message: 'Saved', tone: 'neutral', action: undefined, duration: 5000 },
    ]);
  });

  it('gives toasts with an action more time', () => {
    showToast({ message: 'Deleted', action: { label: 'Undo', onClick: () => {} } });
    expect(getToasts()[0]?.duration).toBe(8000);
  });

  it('dismisses itself after its duration', () => {
    showToast({ message: 'Saved', duration: 3000 });
    vi.advanceTimersByTime(2999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses and resumes the remaining time', () => {
    const id = showToast({ message: 'Saved', duration: 5000 });
    vi.advanceTimersByTime(2000);
    pauseToast(id);
    vi.advanceTimersByTime(60_000);
    expect(getToasts()).toHaveLength(1);
    resumeToast(id);
    vi.advanceTimersByTime(2999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('resumes only when every pause reason is gone', () => {
    const id = showToast({ message: 'Saved', duration: 1000 });
    pauseToast(id, 'focus');
    pauseToast(id, 'hover');
    resumeToast(id, 'hover');
    vi.advanceTimersByTime(5000);
    expect(getToasts()).toHaveLength(1);
    resumeToast(id, 'focus');
    vi.advanceTimersByTime(999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });

  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    const ids = ['a', 'b', 'c', 'd'].map((message) => showToast({ message }));
    expect(getToasts().map((toast) => toast.id)).toEqual(ids.slice(1));
    // The dropped toast's timer is gone too: nothing fires for it later.
    vi.advanceTimersByTime(10_000);
    expect(getToasts()).toHaveLength(0);
  });

  it('runs the action once and dismisses the toast', () => {
    const onClick = vi.fn();
    const id = showToast({ message: 'Deleted', action: { label: 'Undo', onClick } });
    runToastAction(id);
    runToastAction(id);
    expect(onClick).toHaveBeenCalledOnce();
    expect(getToasts()).toHaveLength(0);
  });

  it('notifies subscribers of every change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    const id = showToast({ message: 'Saved' });
    dismissToast(id);
    dismissToast(id);
    unsubscribe();
    showToast({ message: 'Again' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('ToastViewport', () => {
  it('renders a polite live region before any toast exists', () => {
    const { container } = render(<ToastViewport />);
    const region = container.querySelector('section');
    expect(region?.getAttribute('aria-label')).toBe('Notifications');
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows toasts, runs actions and dismisses from the close button', () => {
    const onClick = vi.fn();
    render(<ToastViewport />);
    act(() => {
      showToast({ message: 'Item deleted', action: { label: 'Undo', onClick } });
      showToast({ message: 'Saved' });
    });
    expect(byText('Item deleted')).toBeTruthy();

    click(byText('Undo'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(() => byText('Item deleted')).toThrow();

    click(document.querySelector('[aria-label="Dismiss"]'));
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses auto-dismiss while hovered', () => {
    render(<ToastViewport />);
    act(() => {
      showToast({ message: 'Saved', duration: 1000 });
    });
    const item = byText('Saved').closest('li');
    act(() => {
      item?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(getToasts()).toHaveLength(1);
    act(() => {
      item?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(getToasts()).toHaveLength(0);
  });

  it('stays paused while focused even after the pointer leaves', () => {
    render(<ToastViewport />);
    act(() => {
      showToast({
        message: 'Item deleted',
        duration: 1000,
        action: { label: 'Undo', onClick: () => {} },
      });
    });
    const item = byText('Item deleted').closest('li');
    const undo = byText('Undo');
    const dismiss = document.querySelector<HTMLElement>('[aria-label="Dismiss"]');
    act(() => undo.focus());
    act(() => {
      item?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      item?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(getToasts()).toHaveLength(1);

    // Moving focus between the toast's own buttons keeps it paused.
    act(() => dismiss?.focus());
    act(() => vi.advanceTimersByTime(5000));
    expect(getToasts()).toHaveLength(1);

    act(() => dismiss?.blur());
    act(() => vi.advanceTimersByTime(1000));
    expect(getToasts()).toHaveLength(0);
  });
});
