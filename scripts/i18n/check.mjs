#!/usr/bin/env node
/**
 * pnpm i18n:check
 *
 * Checks every enabled language (APP_LANGUAGES) against English: missing
 * and extra keys, empty strings, placeholder mismatches, plural forms
 * (`_one` without `_other`, forms the language's plural rules need or never
 * use) and Chrome's public/_locales. Draft languages are reported as notes.
 * Exits 1 when there is a problem. Runs in CI.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHROME_NAMESPACE,
  I18nToolError,
  REPO_ROOT,
  SOURCE_LANGUAGE,
  chromeLocaleFolders,
  formatPlaceholders,
  isAllowedKey,
  isMain,
  localeDir,
  namespaceFiles,
  paths,
  placeholders,
  pluralCategories,
  readChromeMessages,
  readLanguages,
  readLocale,
  requiredKeys,
  runCli,
  samePlaceholders,
  sourceText,
  splitPluralKey,
} from './lib.mjs';

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function checkPluralSiblings(label, messages, problems) {
  for (const key of Object.keys(messages)) {
    const plural = splitPluralKey(key);
    if (
      plural &&
      plural.category !== 'other' &&
      !(`${plural.base}_other` in messages)
    ) {
      problems.push(
        `${label}.${key}: plural form without ${plural.base}_other (tn() falls back to _other)`
      );
    }
  }
}

function checkIndex(root, lang, namespaces, problems) {
  const file = join(localeDir(root, lang), 'index.ts');
  if (!existsSync(file)) {
    problems.push(`${lang}: src/i18n/locales/${lang}/index.ts is missing`);
    return;
  }
  const source = readFileSync(file, 'utf8');
  for (const ns of namespaces) {
    if (!source.includes(`from './${ns}'`)) {
      problems.push(`${lang}: index.ts does not import ./${ns}`);
    }
  }
}

function checkNamespace(lang, ns, en, messages, intlLocale, problems) {
  const categories = pluralCategories(intlLocale);
  const label = `${lang}: ${ns}`;
  for (const key of requiredKeys(en, intlLocale)) {
    if (!(key in messages)) {
      const plural = splitPluralKey(key);
      problems.push(
        key in en
          ? `${label}.${key}: missing`
          : `${label}.${key}: missing plural form "${plural.category}" (${intlLocale} uses it; ${plural.base}_other would be shown instead)`
      );
    }
  }
  for (const [key, value] of Object.entries(messages)) {
    if (!isAllowedKey(en, key)) {
      problems.push(`${label}.${key}: not an English key`);
      continue;
    }
    const plural = splitPluralKey(key);
    if (!(key in en) && !categories.includes(plural.category)) {
      problems.push(
        `${label}.${key}: ${intlLocale} never uses the plural category "${plural.category}"`
      );
    }
    if (!hasText(value)) {
      problems.push(`${label}.${key}: empty`);
      continue;
    }
    const expected = placeholders(sourceText(en, key));
    const actual = placeholders(value);
    if (!samePlaceholders(expected, actual)) {
      problems.push(
        `${label}.${key}: placeholders differ (English: ${formatPlaceholders(expected)}; got: ${formatPlaceholders(actual)})`
      );
    }
  }
  checkPluralSiblings(label, messages, problems);
}

function checkChrome(lang, chromeLocale, english, messages, problems) {
  const label = `${lang}: _locales/${chromeLocale}`;
  if (!messages) {
    problems.push(`${label}/messages.json is missing`);
    return;
  }
  for (const key of Object.keys(english)) {
    if (!(key in messages)) problems.push(`${label}: ${key} missing`);
  }
  for (const [key, entry] of Object.entries(messages)) {
    if (!(key in english)) {
      problems.push(`${label}: ${key} is not in _locales/en`);
      continue;
    }
    if (!hasText(entry?.message)) {
      problems.push(`${label}: ${key} has no message`);
      continue;
    }
    const expected = placeholders(english[key].message, CHROME_NAMESPACE);
    const actual = placeholders(entry.message, CHROME_NAMESPACE);
    if (!samePlaceholders(expected, actual)) {
      problems.push(
        `${label}: ${key} placeholders differ (English: ${formatPlaceholders(expected, CHROME_NAMESPACE)}; got: ${formatPlaceholders(actual, CHROME_NAMESPACE)})`
      );
    }
  }
}

/** Progress of a draft: from its TS files, else from its translation.json. */
function draftProgress(root, lang, info, english) {
  let total = 0;
  let done = 0;
  const locale = readLocale(root, lang);
  const jsonFile = join(localeDir(root, lang), 'translation.json');
  const json =
    Object.keys(locale.namespaces).length === 0 && existsSync(jsonFile)
      ? JSON.parse(readFileSync(jsonFile, 'utf8'))
      : null;
  for (const ns of Object.keys(english.namespaces)) {
    for (const key of requiredKeys(english.namespaces[ns], info.intlLocale)) {
      total++;
      const value = json
        ? json.keys?.[`${ns}.${key}`]?.current
        : locale.namespaces[ns]?.[key];
      if (hasText(value)) done++;
    }
  }
  return { total, done, source: json ? 'translation.json' : 'locale files' };
}

/** @returns {{ problems: string[], notes: string[] }} */
export function checkI18n(root = REPO_ROOT) {
  const problems = [];
  const notes = [];
  const languages = readLanguages(root);
  const { enabled, info, drafts } = languages;

  for (const lang of enabled) {
    if (!info[lang])
      problems.push(`${lang}: in APP_LANGUAGES but not in LANGUAGE_INFO`);
    if (drafts[lang])
      problems.push(
        `${lang}: both enabled and a draft; remove the draft entry`
      );
  }
  for (const lang of Object.keys(info)) {
    if (!enabled.includes(lang))
      problems.push(`${lang}: in LANGUAGE_INFO but not in APP_LANGUAGES`);
  }
  if (!enabled.includes(SOURCE_LANGUAGE))
    throw new I18nToolError('English must be enabled');

  const englishNamespaces = namespaceFiles(root, SOURCE_LANGUAGE);
  if (englishNamespaces.length === 0)
    throw new I18nToolError('src/i18n/locales/en has no namespaces');
  const english = readLocale(root, SOURCE_LANGUAGE);
  const chromeEnglish = readChromeMessages(
    root,
    info[SOURCE_LANGUAGE].chromeLocale
  );
  if (!chromeEnglish)
    throw new I18nToolError('public/_locales/en/messages.json is missing');

  checkIndex(root, SOURCE_LANGUAGE, englishNamespaces, problems);
  for (const ns of englishNamespaces) {
    const en = english.namespaces[ns];
    for (const [key, value] of Object.entries(en)) {
      if (!hasText(value)) problems.push(`en: ${ns}.${key}: empty`);
    }
    checkNamespace(SOURCE_LANGUAGE, ns, en, en, info.en.intlLocale, problems);
  }

  for (const lang of enabled) {
    const langInfo = info[lang];
    if (!langInfo) continue;
    if (
      !/^[A-Z]{3}$/.test(langInfo.defaultCurrency) ||
      langInfo.defaultCurrency === 'XXX'
    ) {
      problems.push(
        `${lang}: defaultCurrency "${langInfo.defaultCurrency}" is not a real ISO 4217 code`
      );
    }
    if (lang !== SOURCE_LANGUAGE) {
      if (!existsSync(localeDir(root, lang))) {
        problems.push(
          `${lang}: src/i18n/locales/${lang} is missing (pnpm i18n:export ${lang}, translate, pnpm i18n:import)`
        );
        continue;
      }
      const files = namespaceFiles(root, lang);
      for (const ns of englishNamespaces) {
        if (!files.includes(ns)) problems.push(`${lang}: ${ns}.ts is missing`);
      }
      for (const ns of files) {
        if (!englishNamespaces.includes(ns))
          problems.push(`${lang}: ${ns}.ts has no English namespace`);
      }
      checkIndex(root, lang, englishNamespaces, problems);
      const locale = readLocale(root, lang);
      for (const ns of englishNamespaces) {
        if (!locale.namespaces[ns]) continue;
        checkNamespace(
          lang,
          ns,
          english.namespaces[ns],
          locale.namespaces[ns],
          langInfo.intlLocale,
          problems
        );
      }
    }
    checkChrome(
      lang,
      langInfo.chromeLocale,
      chromeEnglish,
      readChromeMessages(root, langInfo.chromeLocale),
      problems
    );
  }

  // Folders must belong to an enabled or draft language.
  const localesDir = paths(root).locales;
  const folders = existsSync(localesDir)
    ? readdirSync(localesDir).filter((f) =>
        statSync(join(localesDir, f)).isDirectory()
      )
    : [];
  for (const folder of folders) {
    if (!enabled.includes(folder) && !drafts[folder]) {
      problems.push(
        `src/i18n/locales/${folder}: not in APP_LANGUAGES or DRAFT_LANGUAGE_INFO`
      );
    }
  }
  const chromeLocales = new Set(
    [...Object.values(info), ...Object.values(drafts)].map(
      (i) => i.chromeLocale
    )
  );
  for (const folder of chromeLocaleFolders(root)) {
    if (!chromeLocales.has(folder)) {
      problems.push(
        `src/public/_locales/${folder}: no app or draft language uses this Chrome locale`
      );
    }
  }

  for (const [lang, draft] of Object.entries(drafts)) {
    const { total, done, source } = draftProgress(root, lang, draft, english);
    notes.push(
      `${lang} (draft, not shipped): ${done}/${total} strings translated in ${source}. ` +
        (done === total
          ? 'Ready to enable: see "Add a language" in docs/v2/I18N.md.'
          : `Translate src/i18n/locales/${lang}/translation.json, then pnpm i18n:import ${lang} <file>.`)
    );
  }

  return { problems, notes };
}

async function main() {
  const { problems, notes } = checkI18n(REPO_ROOT);
  const { enabled } = readLanguages(REPO_ROOT);
  for (const note of notes) console.log(`[i18n] note: ${note}`);
  if (problems.length) {
    console.error(`[i18n] ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }
  console.log(
    `[i18n] OK: ${enabled.join(', ')} are complete (app strings and _locales).`
  );
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
