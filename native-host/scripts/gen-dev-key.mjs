#!/usr/bin/env node
// @ts-check
/**
 * Generates a public key for the manifest "key" field of development builds,
 * which pins the unpacked extension's ID so the bridge allowlist does not
 * change between machines. The private key is only needed to sign .crx
 * packages, so it is discarded and never written anywhere.
 *
 *   node native-host/scripts/gen-dev-key.mjs            new key + ID
 *   node native-host/scripts/gen-dev-key.mjs --key <b64> ID of an existing key
 */
import { generateKeyPairSync } from 'node:crypto';
import { parseArgs } from 'node:util';
import { extensionIdFromPublicKey } from '../lib/extension-id.mjs';

const { values } = parseArgs({ options: { key: { type: 'string' } } });

let publicKeyDer;
if (values.key) {
  publicKeyDer = Buffer.from(values.key, 'base64');
} else {
  ({ publicKey: publicKeyDer } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  }));
}

console.log(`key: ${publicKeyDer.toString('base64')}`);
console.log(`id:  ${extensionIdFromPublicKey(publicKeyDer)}`);
