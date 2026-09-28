/**
 * Tiny toast store: show() from anywhere, <ToastViewport /> renders the list.
 * Toasts dismiss themselves after `duration` ms; hovering or focusing one
 * pauses its timer (WCAG 2.2.1).
 */
import { useSyncExternalStore } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Defaults: 5s, 8s with an action. */
  duration?: number;
}

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  duration: number;
}

export const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;
const ACTION_DURATION = 8000;

interface Timer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

type Listener = () => void;

let toasts: readonly Toast[] = [];
const timers = new Map<string, Timer>();
const listeners = new Set<Listener>();
let nextId = 0;

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function startTimer(id: string, ms: number): void {
  timers.set(id, {
    handle: setTimeout(() => dismissToast(id), ms),
    remaining: ms,
    startedAt: Date.now(),
  });
}

function clearTimer(id: string): void {
  const timer = timers.get(id);
  if (timer?.handle) clearTimeout(timer.handle);
  timers.delete(id);
}

export function showToast(options: ToastOptions): string {
  const id = `toast-${++nextId}`;
  const toast: Toast = {
    id,
    message: options.message,
    tone: options.tone ?? 'neutral',
    action: options.action,
    duration:
      options.duration ??
      (options.action ? ACTION_DURATION : DEFAULT_DURATION),
  };
  const overflow = toasts.slice(0, Math.max(0, toasts.length + 1 - MAX_TOASTS));
  for (const old of overflow) clearTimer(old.id);
  toasts = [...toasts.slice(overflow.length), toast];
  startTimer(id, toast.duration);
  emit();
  return id;
}

export function dismissToast(id: string): void {
  if (!toasts.some((toast) => toast.id === id)) return;
  clearTimer(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

/** Runs the toast's action, then dismisses it. */
export function runToastAction(id: string): void {
  const toast = toasts.find((item) => item.id === id);
  if (!toast) return;
  dismissToast(id);
  toast.action?.onClick();
}

export function pauseToast(id: string): void {
  const timer = timers.get(id);
  if (!timer?.handle) return;
  clearTimeout(timer.handle);
  timer.handle = null;
  timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
}

export function resumeToast(id: string): void {
  const timer = timers.get(id);
  if (!timer || timer.handle) return;
  startTimer(id, timer.remaining);
}

export function clearToasts(): void {
  for (const id of timers.keys()) clearTimer(id);
  toasts = [];
  emit();
}

export function getToasts(): readonly Toast[] {
  return toasts;
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(subscribeToasts, getToasts, getToasts);
}
