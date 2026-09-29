import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, DRAFT_LANGUAGE_INFO, LANGUAGE_INFO } from './languages';

/**
 * Chrome's own strings (extension name, context menus, shortcut) live in
 * public/_locales/<chromeLocale>/messages.json, one folder per app language.
 */
type ChromeMessages = Record<
  string,
  { message?: unknown; description?: unknown }
>;

const LOCALES_DIR = fileURLToPath(
  new URL('../public/_locales', import.meta.url)
);

function read(chromeLocale: string): ChromeMessages {
  return JSON.parse(
    readFileSync(`${LOCALES_DIR}/${chromeLocale}/messages.json`, 'utf8')
  ) as ChromeMessages;
}

const english = read(LANGUAGE_INFO.en.chromeLocale);
const englishKeys = Object.keys(english).sort();

function placeholders(message: unknown): string[] {
  return [...String(message).matchAll(/\$(\w+)\$/g)]
    .map((m) => m[1] ?? '')
    .sort();
}

describe('public/_locales', () => {
  it('has the default locale (manifest default_locale "en")', () => {
    expect(englishKeys).toContain('appName');
  });

  it.each(APP_LANGUAGES)('has exactly the English keys for %s', (language) => {
    const { chromeLocale } = LANGUAGE_INFO[language];
    const file = `${LOCALES_DIR}/${chromeLocale}/messages.json`;
    expect(existsSync(file), file).toBe(true);
    const messages = read(chromeLocale);
    expect(Object.keys(messages).sort()).toEqual(englishKeys);
    for (const [key, entry] of Object.entries(messages)) {
      expect(typeof entry.message, `${chromeLocale}.${key}`).toBe('string');
      expect(String(entry.message).trim(), `${chromeLocale}.${key}`).not.toBe(
        ''
      );
      expect(placeholders(entry.message), `${chromeLocale}.${key}`).toEqual(
        placeholders(english[key]?.message)
      );
    }
  });

  it('has no folder for a language the app does not ship or draft', () => {
    const known = new Set(
      [
        ...Object.values(LANGUAGE_INFO),
        ...Object.values(DRAFT_LANGUAGE_INFO),
      ].map((info) => info.chromeLocale)
    );
    const folders = readdirSync(LOCALES_DIR);
    expect(folders.filter((folder) => !known.has(folder))).toEqual([]);
  });
});
