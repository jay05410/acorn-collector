// @ts-check
/**
 * Error codes the host reports to the extension. Mirrored by
 * BridgeHostErrorCode in src/lib/bridge/protocol.ts; keep both in sync.
 */
export const HOST_ERROR_CODES = /** @type {const} */ ([
  'bad_request',
  'busy',
  'cancelled',
  'timeout',
  'cli_not_found',
  'not_logged_in',
  'rate_limited',
  'cli_failed',
  'bad_output',
  'internal',
]);

/** @typedef {(typeof HOST_ERROR_CODES)[number]} HostErrorCode */

/** Longest error message forwarded to the extension. */
const MAX_MESSAGE_CHARS = 2000;

export class HostError extends Error {
  /**
   * @param {HostErrorCode} code
   * @param {string} message Diagnostic text; never include secrets.
   */
  constructor(code, message) {
    super(message);
    this.name = 'HostError';
    /** @type {HostErrorCode} */
    this.code = code;
  }
}

/**
 * @typedef {object} ErrorPayload
 * @property {HostErrorCode} code
 * @property {string} message
 */

/**
 * Convert anything thrown into the wire error shape. Unexpected errors become
 * 'internal' with their message, truncated.
 * @param {unknown} error
 * @returns {ErrorPayload}
 */
export function toErrorPayload(error) {
  if (error instanceof HostError) {
    return { code: error.code, message: truncate(error.message) };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: 'internal', message: truncate(message) };
}

/**
 * @param {string} text
 * @param {number} [max]
 */
export function truncate(text, max = MAX_MESSAGE_CHARS) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
