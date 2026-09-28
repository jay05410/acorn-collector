/**
 * Small helpers shared by the capture modules. Dependency-free on purpose:
 * the always-on content script bundles this file.
 */
import { CAPTURE_TRIGGERS, type CaptureTrigger } from './types';

/** A plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isCaptureTrigger(value: unknown): value is CaptureTrigger {
  return (CAPTURE_TRIGGERS as readonly unknown[]).includes(value);
}

/** Lower-case hostname of an absolute URL, or null if it does not parse. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
