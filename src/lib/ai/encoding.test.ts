import { describe, expect, it } from 'vitest';
import { bytesToBase64, bytesToBase64Url, sha256Hex } from './encoding';

describe('bytesToBase64', () => {
  it('matches the platform encoder across chunk boundaries', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 17);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i * 31) % 256;
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    expect(bytesToBase64(bytes)).toBe(btoa(binary));
  });

  it('handles empty input', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('produces unpadded url-safe output', () => {
    const bytes = new Uint8Array([251, 255, 191, 0]);
    expect(bytesToBase64(bytes)).toBe('+/+/AA==');
    expect(bytesToBase64Url(bytes)).toBe('-_-_AA');
  });
});

describe('sha256Hex', () => {
  it('hashes strings and bytes (FIPS 180-2 "abc" vector)', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(await sha256Hex('abc')).toBe(expected);
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(expected);
  });
});
