#!/usr/bin/env node
// @ts-check
/**
 * Live end-to-end check: starts host.mjs exactly as the browser would
 * (caller origin as argv, framed JSON on stdio, config allowlisting that
 * origin), then sends ping, status and one real analyze call on the user's
 * own CLI login.
 *
 *   node native-host/scripts/e2e.mjs --image price-list.jpg [--truth truth.json]
 *     [--target claude|codex] [--model sonnet] [--cli /abs/path] [--debug]
 *
 * --truth takes { currency, items: [{ name, price, options? }] } and prints
 * recall and price/option accuracy against it. This spends one request of
 * the user's subscription.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { sniffImage } from '../lib/validate.mjs';
import { FrameDecoder, encodeFrame } from '../protocol.mjs';

const HOST = join(dirname(fileURLToPath(import.meta.url)), '..', 'host.mjs');
const ORIGIN = `chrome-extension://${'a'.repeat(32)}/`;

/** Mirrors ITEM_CATEGORIES in src/types/index.ts. */
const CATEGORIES = [
  'acrylic',
  'keyring',
  'stand',
  'poster',
  'postcard',
  'sticker',
  'photocard',
  'memo',
  'tape',
  'badge',
  'book',
  'calendar',
  'pouch',
  'plush',
  'apparel',
  'set',
  'digital',
  'other',
];

const nullableString = { type: ['string', 'null'] };
/** Same shape as WireExtraction in src/lib/ai/types.ts. */
const WIRE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['booth', 'currency', 'items'],
  properties: {
    booth: {
      type: 'object',
      additionalProperties: false,
      required: ['number', 'circle', 'event', 'zone', 'mailOrder'],
      properties: {
        number: nullableString,
        circle: nullableString,
        event: nullableString,
        zone: nullableString,
        mailOrder: { type: 'boolean' },
      },
    },
    currency: nullableString,
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'orig', 'price', 'cat', 'opts'],
        properties: {
          name: { type: 'string' },
          orig: nullableString,
          price: { type: ['number', 'null'] },
          cat: { type: 'string', enum: CATEGORIES },
          opts: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const SYSTEM = [
  'You read merchandise price lists from fan-event (doujin) booths and return JSON matching the schema.',
  'items: one entry per product. name: product name translated into Korean. orig: the name exactly as written (null if already Korean).',
  'price: number only, no symbols or separators; null if not shown. cat: closest category. opts: variants such as A/B/C, empty if none.',
  'currency: ISO 4217 code implied by the list (e.g. ¥ at a Japanese event is JPY). booth: fill what is visible, null otherwise.',
].join('\n');

const { values } = parseArgs({
  options: {
    image: { type: 'string' },
    truth: { type: 'string' },
    target: { type: 'string', default: 'claude' },
    model: { type: 'string' },
    cli: { type: 'string' },
    debug: { type: 'boolean', default: false },
  },
});
if (!values.image) {
  console.error(
    'usage: node native-host/scripts/e2e.mjs --image <file> [--truth <file>]'
  );
  process.exit(2);
}
const target = values.target === 'codex' ? 'codex' : 'claude';
const model = values.model ?? (target === 'claude' ? 'sonnet' : '');
const cliPath = values.cli ?? whichSync(target);

const imageBytes = await readFile(values.image);
const kind = sniffImage(imageBytes);
if (!kind) throw new Error(`${values.image} is not a JPEG, PNG or WebP image`);

const workDir = await mkdtemp(join(tmpdir(), 'acorn-e2e-'));
const configFile = join(workDir, 'config.json');
await writeFile(
  configFile,
  JSON.stringify({
    version: 1,
    allowedOrigins: [ORIGIN],
    cliPaths: { claude: null, codex: null, [target]: cliPath },
  })
);

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
const host = spawn(process.execPath, [HOST, ORIGIN], {
  env: {
    ...process.env,
    ACORN_BRIDGE_CONFIG: configFile,
    ...(values.debug ? { ACORN_BRIDGE_DEBUG: '1' } : {}),
  },
  stdio: ['pipe', 'pipe', 'inherit'],
});

/** @type {Map<string, (message: Record<string, any>) => void>} */
const waiting = new Map();
const decoder = new FrameDecoder();
host.stdout.on('data', (/** @type {Buffer} */ chunk) => {
  for (const message of /** @type {Record<string, any>[]} */ (
    decoder.push(chunk)
  )) {
    if (message.status === 'queued' || message.status === 'running') {
      console.log(`[${elapsed()}] ${message.id}: ${message.status}`);
      continue;
    }
    waiting.get(message.id)?.(message);
    waiting.delete(message.id);
  }
});

/**
 * @param {Record<string, unknown>} request
 * @returns {Promise<Record<string, any>>}
 */
function call(request) {
  return new Promise((resolve) => {
    waiting.set(/** @type {string} */ (request.id), resolve);
    host.stdin.write(encodeFrame(request, { maxBytes: 64 * 1024 * 1024 }));
  });
}

try {
  console.log(
    'ping ->',
    JSON.stringify(await call({ id: 'ping', op: 'ping' }))
  );
  const status = await call({ id: 'status', op: 'status' });
  console.log('status ->', JSON.stringify(status, null, 2));

  const t0 = Date.now();
  const response = await call({
    id: 'analyze-1',
    op: 'analyze',
    target,
    model,
    system: SYSTEM,
    text: 'Extract every item and price from this booth price list.',
    images: [
      { mimeType: kind.mimeType, base64: imageBytes.toString('base64') },
    ],
    schema: WIRE_SCHEMA,
  });
  const latencyMs = Date.now() - t0;
  console.log(`analyze -> ${response.status} in ${latencyMs} ms`);
  console.log(JSON.stringify(response.result ?? response.error, null, 2));

  if (response.status === 'ok' && values.truth) {
    const truth = JSON.parse(await readFile(values.truth, 'utf8'));
    console.log(
      'score ->',
      JSON.stringify(score(response.result.output, truth), null, 2)
    );
  }
} finally {
  host.stdin.end();
  await new Promise((resolve) => host.once('exit', resolve));
  await rm(workDir, { recursive: true, force: true });
}

/** @param {string} name */
function whichSync(name) {
  return execFileSync('sh', ['-c', 'command -v -- "$1"', 'sh', name], {
    encoding: 'utf8',
  }).trim();
}

/** @param {unknown} value */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s「」『』"'()（）[\]【】・]/g, '');
}

/**
 * @param {{ currency: string | null, items: Array<{ name: string, orig: string | null, price: number | null, opts: string[] }> }} output
 * @param {{ currency: string, items: Array<{ name: string, price: number, options?: string[] }> }} truth
 */
function score(output, truth) {
  const extracted = output.items.map((item) => ({
    item,
    keys: [normalize(item.orig), normalize(item.name)].filter(Boolean),
  }));
  let found = 0;
  let pricesCorrect = 0;
  let optionsCorrect = 0;
  const missing = [];
  for (const expected of truth.items) {
    const key = normalize(expected.name);
    const match = extracted.find(({ keys }) =>
      keys.some((k) => k === key || k.includes(key) || key.includes(k))
    );
    if (!match) {
      missing.push(expected.name);
      continue;
    }
    found += 1;
    if (match.item.price === expected.price) pricesCorrect += 1;
    const want = (expected.options ?? []).map(normalize).sort().join(',');
    const got = match.item.opts.map(normalize).sort().join(',');
    if (want === got) optionsCorrect += 1;
  }
  return {
    currencyCorrect: output.currency === truth.currency,
    recall: `${found}/${truth.items.length}`,
    priceAccuracy: `${pricesCorrect}/${truth.items.length}`,
    optionsAccuracy: `${optionsCorrect}/${truth.items.length}`,
    extraItems: Math.max(0, output.items.length - found),
    missing,
  };
}
