/**
 * User-facing description of an analysis failure. The local CLI bridge puts
 * a stable code (BridgeMessage) in AIError.message, which is more specific
 * than AIError.code; every other provider is described by AIError.code.
 * Never shows the raw error message, which can contain provider details.
 */
import { t, type MessageKey } from '@/i18n';
import { BRIDGE_MESSAGES, type BridgeMessage } from '@/lib/bridge/errors';
import { AIError, type AIErrorCode } from './types';

/** What the UI offers next to the message. */
export type ErrorAction = 'open-settings' | 'retry' | 'retry-accurate' | 'none';

export type ErrorKind =
  | AIErrorCode
  | BridgeMessage
  /** Host code; the bridge reports it as bridge_forbidden, kept for safety. */
  | 'origin_not_allowed';

export interface ErrorDescription {
  kind: ErrorKind;
  title: string;
  body: string;
  action: ErrorAction;
}

type Key = MessageKey<'aiErrors'>;

interface Entry {
  title: Key;
  body: Key;
  action: ErrorAction;
}

function entry(prefix: string, action: ErrorAction): Entry {
  return {
    title: `${prefix}Title` as Key,
    body: `${prefix}Body` as Key,
    action,
  };
}

export const ERROR_ENTRIES: Readonly<Record<ErrorKind, Entry>> = {
  not_configured: entry('notConfigured', 'open-settings'),
  auth: entry('auth', 'open-settings'),
  rate_limit: entry('rateLimit', 'retry'),
  quota: entry('quota', 'open-settings'),
  network: entry('network', 'retry'),
  timeout: entry('timeout', 'retry'),
  cancelled: entry('cancelled', 'retry'),
  bad_response: entry('badResponse', 'retry-accurate'),
  refused: entry('refused', 'retry-accurate'),
  unavailable: entry('unavailable', 'retry'),
  unknown: entry('unknown', 'retry'),
  bridge_not_installed: entry('bridgeNotInstalled', 'open-settings'),
  bridge_forbidden: entry('bridgeForbidden', 'open-settings'),
  origin_not_allowed: entry('bridgeForbidden', 'open-settings'),
  bridge_disconnected: entry('bridgeDisconnected', 'retry'),
  bridge_permission_missing: entry('bridgePermissionMissing', 'open-settings'),
  bridge_unresponsive: entry('bridgeUnresponsive', 'retry'),
  bridge_outdated: entry('bridgeOutdated', 'open-settings'),
  bridge_protocol_error: entry('bridgeProtocolError', 'retry'),
  bridge_busy: entry('bridgeBusy', 'retry'),
  // Retrying the same payload fails the same way; the user must drop images.
  bridge_bad_request: entry('bridgeBadRequest', 'none'),
  bridge_internal: entry('bridgeInternal', 'retry'),
  cli_not_installed: entry('cliNotInstalled', 'open-settings'),
  cli_not_logged_in: entry('cliNotLoggedIn', 'retry'),
  // A plan limit resets on its own schedule; an immediate retry fails too.
  cli_rate_limited: entry('cliRateLimited', 'none'),
  cli_timeout: entry('cliTimeout', 'retry'),
  cli_failed: entry('cliFailed', 'open-settings'),
  cli_bad_output: entry('cliBadOutput', 'retry'),
  cli_status_check_failed: entry('cliStatusCheckFailed', 'retry'),
};

const BRIDGE_MESSAGE_SET: ReadonlySet<string> = new Set([
  ...BRIDGE_MESSAGES,
  'origin_not_allowed',
]);

function isBridgeKind(value: string): value is BridgeMessage | 'origin_not_allowed' {
  return BRIDGE_MESSAGE_SET.has(value);
}

/** The most specific kind for `error`; anything that is not an AIError is 'unknown'. */
export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof AIError)) return 'unknown';
  if (error.provider === 'cli' && isBridgeKind(error.message)) {
    return error.message;
  }
  return error.code in ERROR_ENTRIES ? error.code : 'unknown';
}

export function describeAIError(error: unknown): ErrorDescription {
  const kind = errorKind(error);
  const { title, body, action } = ERROR_ENTRIES[kind];
  return { kind, title: t('aiErrors', title), body: t('aiErrors', body), action };
}

const ACTION_LABELS: Record<Exclude<ErrorAction, 'none'>, Key> = {
  'open-settings': 'actionOpenSettings',
  retry: 'actionRetry',
  'retry-accurate': 'actionRetryAccurate',
};

export function errorActionLabel(action: Exclude<ErrorAction, 'none'>): string {
  return t('aiErrors', ACTION_LABELS[action]);
}
