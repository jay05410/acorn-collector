import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LocaleMessages } from './define';
import { APP_LANGUAGES, LANGUAGE_INFO, type AppLanguage } from './languages';
import { englishMessages, localeLoaders } from './registry';

/**
 * Runtime twin of the compile-time contract (`satisfies LocaleMessages`) and
 * of `pnpm i18n:check`: every app language has every English key.
 */
type Table = Partial<Record<string, string>>;

const PLACEHOLDER = /\{(\w+)\}/g;
/** Plural forms other than `_other`, which tn() needs as the fallback. */
const PLURAL_FORM = /^(.+)_(zero|one|two|few|many)$/;
const LOCALES_DIR = fileURLToPath(new URL('./locales', import.meta.url));

function placeholders(message: string): string[] {
  return [...message.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '').sort();
}

function namespaceFiles(language: string): string[] {
  return readdirSync(`${LOCALES_DIR}/${language}`)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

const catalogs = Object.fromEntries(
  await Promise.all(
    APP_LANGUAGES.map(async (language) => {
      const load = localeLoaders[language];
      const messages = language === 'en' ? englishMessages : await load?.();
      return [language, messages ?? {}] as const;
    })
  )
) as Record<AppLanguage, LocaleMessages>;
const english = catalogs.en as Record<string, Table>;
const namespaces = Object.keys(english).sort();

describe('locale folders', () => {
  it('registers every English namespace file in locales/en/index.ts', () => {
    expect(namespaces).toEqual(namespaceFiles('en'));
  });

  it('lazy-loads exactly the non-English app languages', () => {
    expect(Object.keys(localeLoaders).sort()).toEqual(
      APP_LANGUAGES.filter((language) => language !== 'en').sort()
    );
  });

  it.each(APP_LANGUAGES)('gives %s the same namespace files', (language) => {
    expect(namespaceFiles(language)).toEqual(namespaceFiles('en'));
    expect(Object.keys(catalogs[language]).sort()).toEqual(namespaces);
  });
});

describe.each(namespaces)('namespace %s', (namespace) => {
  const en = english[namespace] ?? {};
  const enKeys = Object.keys(en).sort();
  const table = (language: string): Table =>
    (catalogs as Record<string, Record<string, Table>>)[language]?.[namespace] ??
    {};

  it('has English messages', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it.each(APP_LANGUAGES)('is complete in %s', (language) => {
    const messages = table(language);
    const categories = new Intl.PluralRules(
      LANGUAGE_INFO[language].intlLocale
    ).resolvedOptions().pluralCategories;
    // Extra plural forms are allowed only for categories the language uses.
    const extra = Object.keys(messages).filter((key) => !(key in en));
    for (const key of extra) {
      const match = PLURAL_FORM.exec(key);
      expect(match, `${language}.${key}`).not.toBeNull();
      expect(enKeys, `${language}.${key}`).toContain(`${match?.[1]}_other`);
      expect(categories, `${language}.${key}`).toContain(
        key.slice(key.lastIndexOf('_') + 1)
      );
    }
    expect(
      Object.keys(messages)
        .filter((key) => key in en)
        .sort()
    ).toEqual(enKeys);
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof value, `${language}.${key}`).toBe('string');
      expect(value?.trim(), `${language}.${key}`).not.toBe('');
    }
  });

  it.each(APP_LANGUAGES)(
    'pairs every plural form with an _other form in %s',
    (language) => {
      const keys = Object.keys(table(language));
      for (const key of keys) {
        const base = PLURAL_FORM.exec(key)?.[1];
        if (base !== undefined) {
          expect(keys, `${language}.${key}`).toContain(`${base}_other`);
        }
      }
    }
  );

  it.each(APP_LANGUAGES)('keeps the English placeholders in %s', (language) => {
    for (const [key, value] of Object.entries(table(language))) {
      const source = en[key] ?? en[key.replace(PLURAL_FORM, '$1_other')] ?? '';
      expect(placeholders(value ?? ''), `${language}.${key}`).toEqual(
        placeholders(source)
      );
    }
  });
});
