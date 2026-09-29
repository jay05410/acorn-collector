import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as languagesModule from '../../src/i18n/languages.ts';
import enMessages from '../../src/i18n/locales/en/index.ts';
import { checkI18n } from './check.mjs';
import { buildExport } from './export.mjs';
import { importTranslation } from './import.mjs';
import {
  REPO_ROOT,
  parseLiteral,
  readLanguages,
  readLocale,
  toValue,
} from './lib.mjs';
import { scaffoldLanguage, dayPickerLocaleExists } from './new.mjs';

/** Every locale of the repo as the TypeScript toolchain sees it, by folder. */
const COMPILED = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../src/i18n/locales/*/index.ts', {
      eager: true,
      import: 'default',
    })
  ).map(([path, messages]) => [path.split('/').at(-2), messages])
);

let root;

/**
 * The languages these tests are written against. The fixture pins them, so
 * shipping or drafting another language in the app does not change the
 * tests (they scaffold fr, ru and de themselves).
 */
const FIXTURE_LANGUAGES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];

/** A throwaway copy of the files the tools read and write. */
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'acorn-i18n-'));
  const { info } = readLanguages(REPO_ROOT);
  const fixtureInfo = Object.fromEntries(
    FIXTURE_LANGUAGES.map((lang) => [lang, info[lang]])
  );
  for (const lang of FIXTURE_LANGUAGES) {
    const chromeLocale = `src/public/_locales/${info[lang].chromeLocale}`;
    for (const path of [`src/i18n/locales/${lang}`, chromeLocale]) {
      cpSync(join(REPO_ROOT, path), join(dir, path), { recursive: true });
    }
  }
  cpSync(join(REPO_ROOT, '.prettierrc'), join(dir, '.prettierrc'));
  writeFileSync(
    join(dir, 'src/i18n/languages.ts'),
    `export const APP_LANGUAGES = ${JSON.stringify(FIXTURE_LANGUAGES)} as const;\n\n` +
      `export const LANGUAGE_INFO = ${JSON.stringify(fixtureInfo, null, 2)} as const;\n\n` +
      'export const DRAFT_LANGUAGE_INFO: Readonly<\n' +
      '  Record<string, LanguageInfo<string>>\n' +
      '> = {};\n'
  );
  return dir;
}

function snapshot(dir) {
  const hashes = {};
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else
        hashes[relative(dir, path)] = createHash('sha1')
          .update(readFileSync(path))
          .digest('hex');
    }
  };
  walk(dir);
  return hashes;
}

function file(path) {
  return join(root, path);
}

function edit(path, from, to) {
  const source = readFileSync(file(path), 'utf8');
  expect(source, `${path} contains ${from}`).toContain(from);
  writeFileSync(file(path), source.replace(from, to));
}

/** A complete fake translation that keeps every placeholder. */
function fakeTranslation(data, prefix) {
  const keys = {};
  for (const [key, entry] of Object.entries(data.keys)) {
    keys[key] = { ...entry, current: `${prefix} ${entry.en}` };
  }
  return { ...data, keys };
}

beforeEach(() => {
  root = copyRepo();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('literal parser', () => {
  it('reads strings with escapes, comments and trailing commas', () => {
    const source = String.raw`{
      // comment
      plain: 'a',
      "quoted-key": "it's \"x\"",
      escaped: 'it\'s\n\té\u{1F600}\x41',
      /* block */ tpl: ${'`'}back${'`'},
      nested: { list: [1, true, null, 'z',], },
    }`;
    expect(toValue(parseLiteral(source))).toEqual({
      plain: 'a',
      'quoted-key': `it's "x"`,
      escaped: "it's\n\té\u{1F600}A",
      tpl: 'back',
      nested: { list: [1, true, null, 'z'] },
    });
  });

  it('rejects code it cannot read as data', () => {
    expect(() => parseLiteral('{ a: `x${y}` }')).toThrow(/template literals/);
    expect(() => parseLiteral('{ a: b }')).toThrow(/expected a literal value/);
    expect(() => parseLiteral("{ a: 'x' b: 'y' }")).toThrow(
      /expected "," or "}"/
    );
  });

  it('reads every locale exactly as the compiler does', () => {
    expect(Object.keys(COMPILED)).toEqual(
      expect.arrayContaining([...languagesModule.APP_LANGUAGES])
    );
    for (const [lang, compiled] of Object.entries(COMPILED)) {
      expect(readLocale(REPO_ROOT, lang).namespaces, lang).toEqual(
        JSON.parse(JSON.stringify(compiled))
      );
    }
  });

  it('reads the language registry exactly as the compiler does', () => {
    const { enabled, info, drafts } = readLanguages(REPO_ROOT);
    expect(enabled).toEqual([...languagesModule.APP_LANGUAGES]);
    expect(info).toEqual(languagesModule.LANGUAGE_INFO);
    expect(drafts).toEqual(languagesModule.DRAFT_LANGUAGE_INFO);
  });
});

describe('i18n:check', () => {
  it('passes on the repository', () => {
    // Notes only describe drafts in progress.
    expect(checkI18n(REPO_ROOT).problems).toEqual([]);
  });

  it('passes on the test copy with nothing to note', () => {
    expect(checkI18n(root)).toEqual({ problems: [], notes: [] });
  });

  it('reports missing and extra keys, placeholders, plurals and _locales', () => {
    edit('src/i18n/locales/ko/common.ts', "  back: '뒤로',\n", '');
    edit(
      'src/i18n/locales/zh-CN/common.ts',
      "  save: '保存',",
      "  save: '保存',\n  bogus: 'x',"
    );
    edit(
      'src/i18n/locales/ja/aiConnect.ts',
      "'既定のモデル: {model}'",
      "'既定のモデル: {modelo}'"
    );
    edit(
      'src/i18n/locales/zh-TW/events.ts',
      'boothCount_other:',
      'boothCountOther:'
    );
    const ja = JSON.parse(
      readFileSync(file('src/public/_locales/ja/messages.json'), 'utf8')
    );
    delete ja.contextMenuAdd;
    writeFileSync(
      file('src/public/_locales/ja/messages.json'),
      JSON.stringify(ja)
    );
    mkdirSync(file('src/i18n/locales/xx'));

    const { problems } = checkI18n(root);
    expect(problems).toEqual(
      expect.arrayContaining([
        'ko: common.back: missing',
        'zh-CN: common.bogus: not an English key',
        'ja: aiConnect.defaultModel: placeholders differ (English: {model}; got: {modelo})',
        'zh-TW: events.boothCount_other: missing',
        'zh-TW: events.boothCountOther: not an English key',
        'zh-TW: events.boothCount_one: plural form without boothCount_other (tn() falls back to _other)',
        'ja: _locales/ja: contextMenuAdd missing',
        'src/i18n/locales/xx: not in APP_LANGUAGES or DRAFT_LANGUAGE_INFO',
      ])
    );
    expect(problems).toHaveLength(8);
  });
});

describe('i18n:export / i18n:import', () => {
  it('exports every key with English, the translation and placeholders', () => {
    const data = buildExport(REPO_ROOT, 'ja');
    expect(data).toMatchObject({ lang: 'ja', source: 'en' });
    expect(data.keys['aiConnect.defaultModel']).toEqual({
      en: 'Default: {model}',
      current: expect.stringContaining('{model}'),
      placeholders: ['model'],
    });
    expect(data.keys['_locales.appName']).toMatchObject({
      en: 'Acorn Collector',
      current: 'どんぐりポケット',
    });
    expect(
      Object.values(data.keys).every((entry) => entry.current !== null)
    ).toBe(true);
  });

  it.each(FIXTURE_LANGUAGES.filter((lang) => lang !== 'en'))(
    'round-trips %s without changing a byte',
    async (lang) => {
      const before = snapshot(root);
      const result = await importTranslation(
        root,
        lang,
        buildExport(root, lang)
      );
      expect(result.written).toEqual([]);
      expect(snapshot(root)).toEqual(before);
    }
  );

  it('patches only the changed value', async () => {
    const data = buildExport(root, 'ja');
    data.keys['common.save'].current = '保存する';
    data.keys['_locales.contextMenuAnalyzeImage'].current = '画像を分析';
    const before = readFileSync(file('src/i18n/locales/ja/common.ts'), 'utf8');

    const { written } = await importTranslation(root, 'ja', data);

    expect(written).toEqual([
      'src/i18n/locales/ja/common.ts',
      'src/public/_locales/ja/messages.json',
    ]);
    const after = readFileSync(file('src/i18n/locales/ja/common.ts'), 'utf8');
    const changed = after
      .split('\n')
      .filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual(["  save: '保存する',"]);
    expect(readLocale(root, 'ja').namespaces.common.save).toBe('保存する');
    const chrome = JSON.parse(
      readFileSync(file('src/public/_locales/ja/messages.json'), 'utf8')
    );
    expect(chrome.contextMenuAnalyzeImage).toEqual({
      message: '画像を分析',
      description: 'Context menu item on images',
    });
    expect(checkI18n(root).problems).toEqual([]);
  });

  it('adds a missing key in English order', async () => {
    edit('src/i18n/locales/ko/common.ts', "  free: '무료',\n", '');
    const data = buildExport(root, 'ko');
    expect(data.keys['common.free'].current).toBeNull();
    data.keys['common.free'].current = '무료';

    await importTranslation(root, 'ko', data);

    const keys = Object.keys(readLocale(root, 'ko').namespaces.common);
    expect(keys).toEqual(Object.keys(enMessages.common));
    expect(checkI18n(root).problems).toEqual([]);
  });

  it.each([
    [
      'a placeholder mismatch',
      (data) => {
        data.keys['aiConnect.defaultModel'].current = '既定のモデル: {modelo}';
      },
      'aiConnect.defaultModel: placeholders differ (English: {model}; translation: {modelo})',
    ],
    [
      'a Chrome placeholder mismatch',
      (data) => {
        data.keys['_locales.appName'].current = '$NAME$';
      },
      '_locales.appName: placeholders differ (English: none; translation: $NAME$)',
    ],
    [
      'an unknown key',
      (data) => {
        data.keys['common.nope'] = { en: 'x', current: 'y', placeholders: [] };
      },
      'common.nope: unknown key (not in src/i18n/locales/en)',
    ],
    [
      'a plural category the language does not use',
      (data) => {
        data.keys['events.boothCount_few'] = {
          en: 'x',
          current: 'y',
          placeholders: [],
        };
      },
      'events.boothCount_few: "few" is not a plural category of ja-JP (other)',
    ],
  ])('refuses %s and writes nothing', async (_name, change, message) => {
    const data = buildExport(root, 'ja');
    change(data);
    const before = snapshot(root);
    await expect(importTranslation(root, 'ja', data)).rejects.toThrow(message);
    expect(snapshot(root)).toEqual(before);
  });

  it('refuses a file for another language or English itself', async () => {
    await expect(
      importTranslation(root, 'ko', buildExport(root, 'ja'))
    ).rejects.toThrow('The file is for "ja", not "ko".');
    await expect(
      importTranslation(root, 'en', buildExport(root, 'en'))
    ).rejects.toThrow('English is the source language');
    await expect(
      importTranslation(root, 'fr', { lang: 'fr', source: 'en', keys: {} })
    ).rejects.toThrow('Unknown language "fr"');
  });
});

describe('i18n:new', () => {
  it('scaffolds a draft that stays out of the app until enabled', async () => {
    const { info, files } = await scaffoldLanguage(root, 'fr', {
      currency: 'EUR',
    });

    expect(info).toEqual({
      code: 'fr',
      nativeName: 'Français',
      englishName: 'French',
      intlLocale: 'fr',
      chromeLocale: 'fr',
      defaultCurrency: 'EUR',
      dayPickerLocale: 'fr',
    });
    expect(files).toEqual([
      'src/i18n/languages.ts',
      'src/i18n/locales/fr/translation.json',
    ]);
    const languages = readLanguages(root);
    expect(languages.enabled).toEqual(FIXTURE_LANGUAGES);
    expect(languages.drafts).toEqual({ fr: info });
    // Chrome's folder ships, so it is created by the import, not here.
    expect(existsSync(file('src/public/_locales/fr'))).toBe(false);

    const translation = JSON.parse(
      readFileSync(file('src/i18n/locales/fr/translation.json'), 'utf8')
    );
    const englishKeys = Object.keys(buildExport(root, 'en').keys);
    const keys = Object.keys(translation.keys);
    // French plural rules also use "many" (1,000,000 livres): one extra form per tn() key.
    const extra = keys.filter((key) => !englishKeys.includes(key));
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.every((key) => key.endsWith('_many'))).toBe(true);
    expect(keys.filter((key) => englishKeys.includes(key))).toEqual(
      englishKeys
    );
    expect(
      Object.values(translation.keys).every((entry) => entry.current === null)
    ).toBe(true);
    const { problems, notes } = checkI18n(root);
    expect(problems).toEqual([]);
    const appKeys = keys.filter((key) => !key.startsWith('_locales.')).length;
    expect(notes).toEqual([
      expect.stringMatching(
        new RegExp(`^fr \\(draft, not shipped\\): 0/${appKeys} strings`)
      ),
    ]);
  });

  it('refuses to import an incomplete draft, then imports the finished one', async () => {
    await scaffoldLanguage(root, 'fr', { currency: 'EUR' });
    const draft = JSON.parse(
      readFileSync(file('src/i18n/locales/fr/translation.json'), 'utf8')
    );
    const translated = fakeTranslation(draft, '[fr]');
    translated.keys['common.save'].current = null;
    await expect(importTranslation(root, 'fr', translated)).rejects.toThrow(
      'common.save: missing translation ("current" is null)'
    );

    translated.keys['common.save'].current = 'Enregistrer';
    const { written } = await importTranslation(root, 'fr', translated);

    expect(written).toContain('src/i18n/locales/fr/index.ts');
    expect(written).toContain('src/public/_locales/fr/messages.json');
    expect(
      written.filter((path) => path.startsWith('src/i18n/locales/fr/'))
    ).toHaveLength(22);
    expect(readLocale(root, 'fr').namespaces.common.save).toBe('Enregistrer');
    const common = readFileSync(file('src/i18n/locales/fr/common.ts'), 'utf8');
    expect(common).toMatch(
      /^import type \{ LocaleMessages \} from '\.\.\/\.\.\/define';/
    );
    expect(common).toContain("} satisfies LocaleMessages['common'];");
    const { problems, notes } = checkI18n(root);
    expect(problems).toEqual([]);
    expect(notes).toEqual([
      expect.stringMatching(
        /: (\d+)\/\1 strings translated in locale files\. Ready to enable/
      ),
    ]);
    expect(readLocale(root, 'fr').namespaces.events.boothCount_many).toBe(
      `[fr] ${enMessages.events.boothCount_other}`
    );
    // A second import of the same file is a no-op.
    expect((await importTranslation(root, 'fr', translated)).written).toEqual(
      []
    );
  });

  it('asks for the plural forms a language needs', async () => {
    await scaffoldLanguage(root, 'ru', { currency: 'RUB' });
    const draft = JSON.parse(
      readFileSync(file('src/i18n/locales/ru/translation.json'), 'utf8')
    );
    expect(draft.keys['events.boothCount_few']).toMatchObject({
      en: enMessages.events.boothCount_other,
      current: null,
      placeholders: ['count'],
    });
    expect(Object.keys(draft.keys)).toEqual(
      expect.arrayContaining([
        'events.boothCount_one',
        'events.boothCount_many',
        'events.boothCount_other',
      ])
    );

    await importTranslation(root, 'ru', fakeTranslation(draft, '[ru]'));
    expect(readLocale(root, 'ru').namespaces.events.boothCount_few).toBe(
      `[ru] ${enMessages.events.boothCount_other}`
    );
    expect(checkI18n(root).problems).toEqual([]);
  });

  it('refuses existing languages and malformed codes', async () => {
    await expect(scaffoldLanguage(root, 'ja')).rejects.toThrow(
      'ja is already an app language.'
    );
    await expect(scaffoldLanguage(root, 'french')).rejects.toThrow(
      'is not a language code'
    );
    await scaffoldLanguage(root, 'de', { currency: 'EUR' });
    await expect(scaffoldLanguage(root, 'de')).rejects.toThrow(
      'de is already a draft.'
    );
  });
});

describe('dayPickerLocaleExists', () => {
  it('accepts calendar locales that ship with react-day-picker', () => {
    expect(dayPickerLocaleExists('ja')).toBe(true);
    expect(dayPickerLocaleExists('zh-TW')).toBe(true);
  });

  it('rejects ids that only match the exports pattern', () => {
    expect(dayPickerLocaleExists('xx-NOPE')).toBe(false);
    expect(dayPickerLocaleExists('es-419')).toBe(false);
  });
});
