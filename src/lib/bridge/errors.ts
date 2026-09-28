/**
 * Mapping of bridge failures onto AIError. `code` drives retry logic and the
 * UI's generic message; `message` is a stable code (BridgeMessage) the UI can
 * use for bridge-specific help, e.g. install instructions for
 * 'bridge_not_installed'. Host diagnostics go to `cause`, never to `message`.
 *
 * Failures that an automatic retry cannot fix (host not installed or not
 * allowed, a CLI run that failed) use non-retryable codes; only a host that
 * exited or stopped answering is 'unavailable'.
 */
import { AIError, type AIErrorCode } from '@/lib/ai/types';
import type { BridgeHostErrorCode } from './protocol';

export const BRIDGE_MESSAGES = [
  'bridge_not_installed',
  'bridge_forbidden',
  'bridge_disconnected',
  'bridge_permission_missing',
  'bridge_unresponsive',
  'bridge_outdated',
  'bridge_protocol_error',
  'bridge_busy',
  'bridge_bad_request',
  'bridge_internal',
  'cancelled',
  'cli_not_installed',
  'cli_not_logged_in',
  'cli_rate_limited',
  'cli_timeout',
  'cli_failed',
  'cli_bad_output',
  'cli_status_check_failed',
] as const;

export type BridgeMessage = (typeof BRIDGE_MESSAGES)[number];

export function bridgeError(
  code: AIErrorCode,
  message: BridgeMessage,
  cause?: string
): AIError {
  const error = new AIError(code, message, 'cli');
  if (cause) error.cause = cause;
  return error;
}

const HOST_ERRORS: Record<BridgeHostErrorCode, [AIErrorCode, BridgeMessage]> = {
  bad_request: ['unknown', 'bridge_bad_request'],
  busy: ['rate_limit', 'bridge_busy'],
  cancelled: ['cancelled', 'cancelled'],
  timeout: ['timeout', 'cli_timeout'],
  cli_not_found: ['not_configured', 'cli_not_installed'],
  not_logged_in: ['auth', 'cli_not_logged_in'],
  rate_limited: ['rate_limit', 'cli_rate_limited'],
  // Not a login, usage-limit or timeout failure (those have their own codes):
  // e.g. a bad flag, an unknown model or a crash, which a rerun repeats.
  cli_failed: ['unknown', 'cli_failed'],
  bad_output: ['bad_response', 'cli_bad_output'],
  origin_not_allowed: ['not_configured', 'bridge_forbidden'],
  internal: ['unknown', 'bridge_internal'],
};

export function fromHostError(error: {
  code: BridgeHostErrorCode;
  message: string;
}): AIError {
  const [code, message] = HOST_ERRORS[error.code];
  return bridgeError(code, message, error.message);
}

/**
 * Map chrome.runtime.lastError after a native port closed or a one-shot
 * sendNativeMessage failed. Chrome reports e.g. "Specified native messaging
 * host not found." or "Native host has exited."
 */
export function fromRuntimeError(message: string | undefined): AIError {
  const text = message ?? '';
  if (/not found/i.test(text)) {
    return bridgeError('not_configured', 'bridge_not_installed', text);
  }
  if (/forbidden/i.test(text)) {
    // The host manifest does not list this extension: re-run the installer.
    return bridgeError('not_configured', 'bridge_forbidden', text);
  }
  return bridgeError('unavailable', 'bridge_disconnected', text || undefined);
}
