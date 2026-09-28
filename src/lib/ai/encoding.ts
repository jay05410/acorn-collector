/** Byte encoding and hashing primitives shared by image prep, cache and PKCE. */

/** Bytes per String.fromCharCode call; well under engine argument limits. */
const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE)));
  }
  return btoa(parts.join(''));
}

/** RFC 4648 section 5 (URL-safe alphabet, no padding). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bytes backed by a plain ArrayBuffer (what WebCrypto accepts). */
export type Bytes = Uint8Array<ArrayBuffer>;

export async function sha256(data: string | Bytes): Promise<Bytes> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Hex(data: string | Bytes): Promise<string> {
  const digest = await sha256(data);
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
