import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * UI strings must come from src/i18n/messages. This scan fails on Hangul,
 * Kana or Han characters anywhere else in src/**\/*.{ts,tsx}.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const CJK =
  /[\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

const EXCLUDED: readonly RegExp[] = [
  /^i18n\/messages\//,
  // Frozen contract: each language's native name for the language picker.
  /^i18n\/languages\.ts$/,
  // Keyword dictionaries for the offline text parser.
  /^lib\/parser\//,
  /\.test\.tsx?$/,
  // Context-menu title; this entrypoint belongs to ACORN-5 and must move to
  // chrome.i18n there. Remove this entry once it has.
  /^entrypoints\/background\.ts$/,
];

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split('\\').join('/'))
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)));
}

describe('UI text', () => {
  it('scans the source tree', () => {
    expect(sourceFiles()).toContain('components/SettingsModal.tsx');
  });

  it('has no hardcoded Hangul, Kana or Han outside i18n messages', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      readFileSync(SRC + file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (CJK.test(line))
            offenders.push(`src/${file}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
