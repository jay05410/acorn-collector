import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { extensionIdFromPublicKey } from './extension-id.mjs';

describe('extensionIdFromPublicKey', () => {
  it('maps the first 32 hex digits of SHA-256 to a-p', () => {
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223 b003...
    expect(extensionIdFromPublicKey(Buffer.from('abc'))).toBe(
      'lkhibglpipabmpokebebeanofnkocccd'
    );
  });

  it('yields a valid 32-letter ID for a generated RSA key', () => {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    expect(extensionIdFromPublicKey(publicKey)).toMatch(/^[a-p]{32}$/);
  });
});
