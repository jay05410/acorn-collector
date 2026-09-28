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
];

/**
 * Non-UI data files (model prompts, keyword dictionaries, fixtures) may opt
 * out with this marker in their first five lines, followed by a reason:
 *   // i18n-scan-ignore-file: <reason>
 */
const OPT_OUT = /^\s*\/\/ i18n-scan-ignore-file: \S/;

function optedOut(file: string): boolean {
  return readFileSync(SRC + file, 'utf8')
    .split('\n', 5)
    .some((line) => OPT_OUT.test(line));
}

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split('\\').join('/'))
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
    .filter((file) => !optedOut(file));
}

describe('UI text', () => {
  it('scans the source tree', () => {
    expect(sourceFiles()).toContain('components/SettingsModal.tsx');
  });

  it('requires a reason on opt-out markers', () => {
    expect(OPT_OUT.test('// i18n-scan-ignore-file: model prompt')).toBe(true);
    expect(OPT_OUT.test('// i18n-scan-ignore-file:')).toBe(false);
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
