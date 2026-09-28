// @ts-check
/**
 * Validation of extension -> host requests. Everything arriving on stdin is
 * untrusted until it passes through parseRequest().
 */
import { HostError } from './errors.mjs';

export const CLI_TARGETS = /** @type {const} */ (['claude', 'codex']);
export const MAX_IMAGES = 6;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_CHARS = 100_000;
/**
 * System prompt and schema travel on the command line; together they must
 * stay under Windows' 32,767-character limit.
 */
export const MAX_SYSTEM_CHARS = 12_000;
export const MAX_SCHEMA_CHARS = 16_000;
const MAX_ID_CHARS = 64;
/** CLI model aliases or IDs, e.g. "sonnet", "claude-opus-5-5[1m]", "gpt-6-luna". */
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]{0,127}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** @typedef {(typeof CLI_TARGETS)[number]} CliTarget */

/**
 * @typedef {object} ImageFile
 * @property {'image/jpeg' | 'image/png' | 'image/webp'} mimeType Sniffed from
 *   the bytes; the extension's declared type is ignored.
 * @property {'jpg' | 'png' | 'webp'} extension
 * @property {string} base64
 * @property {Buffer} bytes
 */

/**
 * @typedef {object} AnalyzeRequest
 * @property {string} id
 * @property {'analyze'} op
 * @property {CliTarget} target
 * @property {string} model Empty string means the CLI's default model.
 * @property {string} system
 * @property {string} text
 * @property {ImageFile[]} images
 * @property {Record<string, unknown>} schema
 */

/**
 * @typedef {{ id: string, op: 'ping' }
 *   | { id: string, op: 'status' }
 *   | { id: string, op: 'cancel', targetId: string }
 *   | AnalyzeRequest} BridgeRequest
 */

/**
 * Best-effort id of a malformed request, so its error can still be routed.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function requestIdOf(raw) {
  return isRecord(raw) && isId(raw.id) ? raw.id : null;
}

/**
 * @param {unknown} raw
 * @returns {BridgeRequest}
 */
export function parseRequest(raw) {
  if (!isRecord(raw)) throw badRequest('request must be a JSON object');
  const { id, op } = raw;
  if (!isId(id)) {
    throw badRequest(
      `id must be a non-empty string of at most ${MAX_ID_CHARS} characters`
    );
  }
  switch (op) {
    case 'ping':
    case 'status':
      return { id, op };
    case 'cancel':
      if (!isId(raw.targetId)) throw badRequest('cancel needs a targetId');
      return { id, op, targetId: raw.targetId };
    case 'analyze':
      return parseAnalyze(id, raw);
    default:
      throw badRequest(`unknown op ${JSON.stringify(op)}`);
  }
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} raw
 * @returns {AnalyzeRequest}
 */
function parseAnalyze(id, raw) {
  const target = raw.target;
  if (!CLI_TARGETS.includes(/** @type {CliTarget} */ (target))) {
    throw badRequest(`target must be one of ${CLI_TARGETS.join(', ')}`);
  }
  const model = optionalString(raw.model, 'model', 128);
  if (model !== '' && !MODEL_PATTERN.test(model)) {
    throw badRequest('model contains unsupported characters');
  }
  const system = optionalString(raw.system, 'system', MAX_SYSTEM_CHARS);
  const text = optionalString(raw.text, 'text', MAX_TEXT_CHARS);

  const rawImages = raw.images ?? [];
  if (!Array.isArray(rawImages)) throw badRequest('images must be an array');
  if (rawImages.length > MAX_IMAGES) {
    throw badRequest(`at most ${MAX_IMAGES} images per request`);
  }
  const images = rawImages.map((image, index) => decodeImage(image, index));
  if (text.trim() === '' && images.length === 0) {
    throw badRequest('nothing to analyze: text and images are both empty');
  }

  const schema = raw.schema;
  if (!isRecord(schema)) throw badRequest('schema must be a JSON object');
  if (JSON.stringify(schema).length > MAX_SCHEMA_CHARS) {
    throw badRequest(`schema exceeds ${MAX_SCHEMA_CHARS} characters`);
  }

  return {
    id,
    op: 'analyze',
    target: /** @type {CliTarget} */ (target),
    model,
    system,
    text,
    images,
    schema,
  };
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {ImageFile}
 */
export function decodeImage(raw, index) {
  const label = `images[${index}]`;
  if (!isRecord(raw) || typeof raw.base64 !== 'string') {
    throw badRequest(`${label} must be an object with a base64 string`);
  }
  const base64 = raw.base64;
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    !BASE64_PATTERN.test(base64)
  ) {
    throw badRequest(`${label} is not valid base64`);
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if ((base64.length / 4) * 3 - padding > MAX_IMAGE_BYTES) {
    throw badRequest(`${label} exceeds ${MAX_IMAGE_BYTES} bytes`);
  }
  const bytes = Buffer.from(base64, 'base64');
  const kind = sniffImage(bytes);
  if (!kind) throw badRequest(`${label} is not a JPEG, PNG or WebP image`);
  return { ...kind, base64, bytes };
}

/**
 * Identify an image by its magic bytes.
 * @param {Uint8Array} bytes
 * @returns {Pick<ImageFile, 'mimeType' | 'extension'> | null}
 */
export function sniffImage(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (b, i) => bytes[i] === b
    )
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 12) === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} end
 */
function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * @param {unknown} value
 * @param {string} name
 * @param {number} max
 * @returns {string}
 */
function optionalString(value, name, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw badRequest(`${name} must be a string`);
  if (value.length > max) throw badRequest(`${name} exceeds ${max} characters`);
  return value;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_CHARS
  );
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} message */
function badRequest(message) {
  return new HostError('bad_request', message);
}
