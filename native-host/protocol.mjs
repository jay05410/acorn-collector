// @ts-check
/**
 * Chrome Native Messaging framing. Every message is UTF-8 JSON preceded by
 * its byte length as a 32-bit unsigned integer in native byte order.
 * https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-protocol
 */
import { endianness } from 'node:os';

/** Bumped when request or response shapes change incompatibly. */
export const PROTOCOL_VERSION = 1;

export const HEADER_BYTES = 4;
/** Chrome drops host -> extension messages larger than 1 MB. */
export const MAX_OUTGOING_BYTES = 1024 * 1024;
/** Chrome's limit for extension -> host messages (64 MiB). */
export const MAX_INCOMING_BYTES = 64 * 1024 * 1024;

const NATIVE_LITTLE_ENDIAN = endianness() === 'LE';

export class FrameError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'FrameError';
  }
}

/**
 * @typedef {object} FrameOptions
 * @property {number} [maxBytes] Largest accepted JSON body in bytes.
 * @property {boolean} [littleEndian] Header byte order (defaults to native).
 */

/**
 * Serialize one message into a length-prefixed frame.
 * @param {unknown} message JSON-serializable value.
 * @param {FrameOptions} [options]
 * @returns {Buffer}
 */
export function encodeFrame(message, options = {}) {
  const { maxBytes = MAX_OUTGOING_BYTES, littleEndian = NATIVE_LITTLE_ENDIAN } =
    options;
  const json = JSON.stringify(message);
  if (json === undefined) {
    throw new FrameError('message is not JSON-serializable');
  }
  const body = Buffer.from(json, 'utf8');
  if (body.length > maxBytes) {
    throw new FrameError(
      `message of ${body.length} bytes exceeds the ${maxBytes}-byte limit`
    );
  }
  const header = Buffer.allocUnsafe(HEADER_BYTES);
  if (littleEndian) header.writeUInt32LE(body.length, 0);
  else header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * Resolves once everything already written to `stream` has been handed to
 * the OS, or the stream has failed. A zero-length write completes after all
 * earlier writes; 'drain' would not do, because it only fires after a write
 * returned false, so a small backlog could leave it pending forever.
 * @param {import('node:stream').Writable} stream
 * @returns {Promise<void>}
 */
export function flushStream(stream) {
  return new Promise((resolve) => {
    if (stream.destroyed || stream.writableLength === 0) {
      resolve();
      return;
    }
    stream.write('', () => resolve());
  });
}

/**
 * Incremental decoder: feed arbitrary chunks (a frame may be split anywhere,
 * including inside the header) and get back every completed message. Chunks
 * are joined once per frame, so large frames are copied O(n) times total.
 */
export class FrameDecoder {
  /** @type {Buffer[]} */
  #chunks = [];
  #buffered = 0;
  /** Body length of the frame being read, or -1 while waiting for a header. */
  #expected = -1;
  #maxBytes;
  #littleEndian;

  /** @param {FrameOptions} [options] */
  constructor(options = {}) {
    this.#maxBytes = options.maxBytes ?? MAX_INCOMING_BYTES;
    this.#littleEndian = options.littleEndian ?? NATIVE_LITTLE_ENDIAN;
  }

  /**
   * @param {Buffer} chunk
   * @returns {unknown[]} Messages completed by this chunk, in order.
   * @throws {FrameError} On an oversized frame or a body that is not JSON.
   *   The stream cannot be trusted afterwards.
   */
  push(chunk) {
    if (chunk.length > 0) {
      this.#chunks.push(chunk);
      this.#buffered += chunk.length;
    }
    /** @type {unknown[]} */
    const messages = [];
    for (;;) {
      if (this.#expected < 0) {
        if (this.#buffered < HEADER_BYTES) break;
        const header = this.#take(HEADER_BYTES);
        const length = this.#littleEndian
          ? header.readUInt32LE(0)
          : header.readUInt32BE(0);
        if (length > this.#maxBytes) {
          throw new FrameError(
            `incoming frame of ${length} bytes exceeds the ${this.#maxBytes}-byte limit`
          );
        }
        this.#expected = length;
      }
      if (this.#buffered < this.#expected) break;
      const body = this.#take(this.#expected);
      this.#expected = -1;
      try {
        messages.push(JSON.parse(body.toString('utf8')));
      } catch {
        throw new FrameError('incoming frame is not valid JSON');
      }
    }
    return messages;
  }

  /** True while part of a frame is buffered (EOF now would truncate it). */
  get hasPartialFrame() {
    return this.#buffered > 0 || this.#expected >= 0;
  }

  /**
   * Remove and return the next `size` buffered bytes.
   * @param {number} size
   * @returns {Buffer}
   */
  #take(size) {
    /** @type {Buffer[]} */
    const parts = [];
    let needed = size;
    while (needed > 0) {
      const head = /** @type {Buffer} */ (this.#chunks[0]);
      if (head.length <= needed) {
        parts.push(head);
        this.#chunks.shift();
        needed -= head.length;
      } else {
        parts.push(head.subarray(0, needed));
        this.#chunks[0] = head.subarray(needed);
        needed = 0;
      }
    }
    this.#buffered -= size;
    return parts.length === 1
      ? /** @type {Buffer} */ (parts[0])
      : Buffer.concat(parts, size);
  }
}
