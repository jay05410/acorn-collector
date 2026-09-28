// @ts-check
import { createHash } from 'node:crypto';

/**
 * Chrome derives an extension's ID from its public key: the first 32 hex
 * digits of SHA-256(DER SubjectPublicKeyInfo), with 0-f mapped to a-p.
 * @param {Uint8Array} publicKeyDer
 * @returns {string}
 */
export function extensionIdFromPublicKey(publicKeyDer) {
  const hex = createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32);
  return Array.from(hex, (digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}
