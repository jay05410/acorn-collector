import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE_LANGUAGES, APP_LANGUAGES } from './languages';
import { namespaces } from './registry';

type Table = Partial<Record<string, Partial<Record<string, string>>>>;

const PLACEHOLDER = /\{(\w+)\}/g;
/** Plural forms other than `_other`, which tn() needs as the fallback. */
const PLURAL_FORM = /^(.+)_(zero|one|two|few|many)$/;
const EXTENDED_LANGUAGES = APP_LANGUAGES.filter(
  (lang) => !(CORE_LANGUAGES as readonly string[]).includes(lang)
);

function placeholders(message: string): string[] {
  return [...message.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '').sort();
}

const entries = Object.entries(namespaces).map(
  ([name, table]) => [name, table as Table] as const
);

describe('message registry', () => {
  it('registers every file in ./messages', () => {
    const dir = fileURLToPath(new URL('./messages', import.meta.url));
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect(Object.keys(namespaces).sort()).toEqual(files);
  });
});

describe.each(entries)('namespace %s', (_name, table) => {
  const en = table.en ?? {};
  const enKeys = Object.keys(en).sort();

  it('has English messages', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it.each(CORE_LANGUAGES)('is complete in %s', (lang) => {
    const messages = table[lang] ?? {};
    expect(Object.keys(messages).sort()).toEqual(enKeys);
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof value, `${lang}.${key}`).toBe('string');
      expect(value?.trim(), `${lang}.${key}`).not.toBe('');
    }
  });

  it.each(EXTENDED_LANGUAGES)('only uses English keys in %s', (lang) => {
    const messages = table[lang] ?? {};
    for (const [key, value] of Object.entries(messages)) {
      expect(enKeys, `${lang}.${key}`).toContain(key);
      expect(value?.trim(), `${lang}.${key}`).not.toBe('');
    }
  });

  it.each(APP_LANGUAGES)(
    'pairs every plural form with an _other form in %s',
    (lang) => {
      const keys = Object.keys(table[lang] ?? {});
      for (const key of keys) {
        const base = PLURAL_FORM.exec(key)?.[1];
        if (base !== undefined) {
          expect(keys, `${lang}.${key}`).toContain(`${base}_other`);
        }
      }
    }
  );

  it.each(APP_LANGUAGES)('keeps the English placeholders in %s', (lang) => {
    const messages = table[lang] ?? {};
    for (const [key, value] of Object.entries(messages)) {
      expect(placeholders(value ?? ''), `${lang}.${key}`).toEqual(
        placeholders(en[key] ?? '')
      );
    }
  });
});
