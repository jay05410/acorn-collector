/// <reference types="node" />
/**
 * Live smoke test against the real OpenAI API. Skipped unless LIVE_AI=1.
 *   LIVE_AI=1 OPENAI_API_KEY=... FIXTURE_DIR=/path/to/fixtures npx vitest run src/lib/ai/live.test.ts
 * FIXTURE_DIR holds <name>.jpg and <name>.truth.json ({currency, items: [{name, price, options?}]}).
 * Two calls, well under $0.01.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '@/lib/settings-types';
import { extractBooth } from './engine';
import type { DecodedImage, ImageCodec } from './image';
import { normalizeName } from './schema';
import type { ExtractedItem } from './types';

const LIVE = process.env.LIVE_AI === '1';
const FIXTURES = ['ja-comiket', 'ko-stylized'];

interface Truth {
  currency: string;
  items: Array<{ name: string; price: number; options?: string[] }>;
}

/** Reads JPEG dimensions from the SOFn header; fixtures are sent without re-encoding. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  const at = (i: number) => bytes[i] ?? 0;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (at(i) !== 0xff) {
      i++;
      continue;
    }
    const marker = at(i + 1);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return { height: (at(i + 5) << 8) | at(i + 6), width: (at(i + 7) << 8) | at(i + 8) };
    i += 2 + ((at(i + 2) << 8) | at(i + 3));
  }
  throw new Error('JPEG has no SOF marker');
}

const nodeCodec: ImageCodec<DecodedImage> = {
  async decode(blob) {
    return { ...jpegSize(new Uint8Array(await blob.arrayBuffer())), close: () => undefined };
  },
  async encodeJpeg() {
    throw new Error('Re-encoding needs a browser; fixtures must already fit the model limits');
  },
};

/** Same rule as the benchmark scorer: substring either way, the shorter side >= 60%. */
function sameName(truth: string, candidate: string | null): boolean {
  if (candidate === null) return false;
  const t = normalizeName(truth);
  const c = normalizeName(candidate);
  return c.includes(t) || (t.includes(c) && c.length >= Math.max(2, t.length * 0.6));
}

function findItem(items: ExtractedItem[], name: string): ExtractedItem | undefined {
  return items.find((item) => sameName(name, item.originalName) || sameName(name, item.name));
}

describe.skipIf(!LIVE)('live OpenAI extraction', () => {
  const dir = process.env.FIXTURE_DIR ?? '';
  const apiKey = process.env.OPENAI_API_KEY ?? '';

  it.each(FIXTURES)(
    '%s: every truth item is found with the right price',
    async (fixture) => {
      expect(apiKey, 'OPENAI_API_KEY').not.toBe('');
      const truth = JSON.parse(readFileSync(join(dir, `${fixture}.truth.json`), 'utf8')) as Truth;
      const image = new Blob([new Uint8Array(readFileSync(join(dir, `${fixture}.jpg`)))]);

      const result = await extractBooth(
        { text: '', images: [image], targetLanguage: 'ko' },
        {
          settings: { ...DEFAULT_AI_SETTINGS, provider: 'openai', openai: { apiKey, model: null } },
          codec: nodeCodec,
        }
      );
      console.info(
        `[live] ${fixture}: ${result.meta.latencyMs} ms, model=${result.meta.model}, ` +
          `in=${result.meta.inputTokens} out=${result.meta.outputTokens}, items=${result.items.length}`
      );

      expect(result.currency).toBe(truth.currency);
      for (const expected of truth.items) {
        const found = findItem(result.items, expected.name);
        expect(found, `missing "${expected.name}"`).toBeDefined();
        expect(found?.price, `price of "${expected.name}"`).toBe(expected.price);
        for (const option of expected.options ?? []) {
          expect(found?.options.map(normalizeName), `option ${option}`).toContain(normalizeName(option));
        }
      }
    },
    60_000
  );
});
