#!/usr/bin/env node
/**
 * pnpm i18n:import <lang> <file> [--dry-run]
 *
 * Applies a translation file (from i18n:export) to
 * src/i18n/locales/<lang>/*.ts and src/public/_locales/<chromeLocale>/.
 * Existing files are patched in place (only changed values; comments and
 * order kept), new ones are generated; written files go through prettier.
 *
 * Refuses, writing nothing, when a translation changes the placeholders,
 * names an unknown key, or when the result would still miss a translation
 * ("current": null). An import of an unchanged export writes nothing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CHROME_NAMESPACE,
  I18nToolError,
  REPO_ROOT,
  SOURCE_LANGUAGE,
  chromeMessagesFile,
  formatPlaceholders,
  isAllowedKey,
  isMain,
  languageInfo,
  localeDir,
  namespaceFiles,
  parseArgs,
  patchNamespaceSource,
  placeholders,
  pluralCategories,
  readChromeMessages,
  readLanguages,
  readLocale,
  rel,
  renderIndexFile,
  renderNamespaceFile,
  requiredKeys,
  runCli,
  samePlaceholders,
  sourceText,
  splitPluralKey,
  writeFormatted,
} from './lib.mjs';

const MAX_LISTED = 25;

function listed(items) {
  return items.length > MAX_LISTED
    ? [
        ...items.slice(0, MAX_LISTED),
        `... and ${items.length - MAX_LISTED} more`,
      ]
    : items;
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Same keys and messages (and descriptions), in any order. */
function sameChromeMessages(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) =>
      b[key] &&
      a[key].message === b[key].message &&
      (a[key].description ?? null) === (b[key].description ?? null)
  );
}

/**
 * @param {string} root repository root
 * @param {string} lang language code (enabled or draft, not English)
 * @param {unknown} data parsed translation file
 * @returns {Promise<{ written: string[], warnings: string[], translated: number }>}
 */
export async function importTranslation(
  root,
  lang,
  data,
  { dryRun = false } = {}
) {
  if (lang === SOURCE_LANGUAGE) {
    throw new I18nToolError(
      'English is the source language: edit src/i18n/locales/en directly.'
    );
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.keys !== 'object' ||
    data.keys === null
  ) {
    throw new I18nToolError(
      'Not a translation file: expected { lang, source, keys }.'
    );
  }
  if (data.lang !== lang) {
    throw new I18nToolError(`The file is for "${data.lang}", not "${lang}".`);
  }
  if (data.source !== SOURCE_LANGUAGE) {
    throw new I18nToolError(
      `Unsupported source language "${data.source}" (expected "en").`
    );
  }

  const languages = readLanguages(root);
  const info = languageInfo(languages, lang);
  const categories = pluralCategories(info.intlLocale);
  const english = readLocale(root, SOURCE_LANGUAGE);
  const existing = readLocale(root, lang);
  const chromeEnglish =
    readChromeMessages(root, languages.info[SOURCE_LANGUAGE].chromeLocale) ??
    {};
  const chromeExisting = readChromeMessages(root, info.chromeLocale) ?? {};

  const problems = [];
  const warnings = [];
  /** @type {Map<string, Map<string, string>>} */
  const updates = new Map();
  /** @type {Map<string, string>} */
  const chromeUpdates = new Map();
  let translated = 0;

  for (const [fullKey, entry] of Object.entries(data.keys)) {
    const dot = fullKey.indexOf('.');
    const ns = dot === -1 ? '' : fullKey.slice(0, dot);
    const key = fullKey.slice(dot + 1);
    if (typeof entry !== 'object' || entry === null) {
      problems.push(`${fullKey}: not an object`);
      continue;
    }
    const value = entry.current;
    if (value !== null && value !== undefined && typeof value !== 'string') {
      problems.push(`${fullKey}: "current" must be a string or null`);
      continue;
    }

    let source;
    if (ns === CHROME_NAMESPACE) {
      source = chromeEnglish[key]?.message;
      if (source === undefined) {
        problems.push(
          `${fullKey}: unknown key (not in public/_locales/en/messages.json)`
        );
        continue;
      }
    } else {
      const en = english.namespaces[ns];
      if (!en || !isAllowedKey(en, key)) {
        problems.push(`${fullKey}: unknown key (not in src/i18n/locales/en)`);
        continue;
      }
      const plural = splitPluralKey(key);
      if (!(key in en) && !categories.includes(plural.category)) {
        problems.push(
          `${fullKey}: "${plural.category}" is not a plural category of ${info.intlLocale} (${categories.join(', ')})`
        );
        continue;
      }
      source = sourceText(en, key);
    }

    if (entry.en !== undefined && entry.en !== source) {
      warnings.push(
        `${fullKey}: the English text changed since the export; review the translation`
      );
    }
    if (!hasText(value)) continue;

    const expected = placeholders(source, ns);
    const actual = placeholders(value, ns);
    if (!samePlaceholders(expected, actual)) {
      problems.push(
        `${fullKey}: placeholders differ (English: ${formatPlaceholders(expected, ns)}; translation: ${formatPlaceholders(actual, ns)})`
      );
      continue;
    }
    translated++;
    if (ns === CHROME_NAMESPACE) chromeUpdates.set(key, value);
    else {
      if (!updates.has(ns)) updates.set(ns, new Map());
      updates.get(ns).set(key, value);
    }
  }

  // The result must be complete: every key translated, here or already.
  const missing = [];
  const plans = [];
  for (const ns of namespaceFiles(root, SOURCE_LANGUAGE)) {
    const current = existing.namespaces[ns] ?? {};
    const wanted = requiredKeys(english.namespaces[ns], info.intlLocale).map(
      (key) => [key, updates.get(ns)?.get(key) ?? current[key]]
    );
    for (const [key, value] of wanted)
      if (!hasText(value)) missing.push(`${ns}.${key}`);
    plans.push({ ns, wanted });
  }
  const chromeWanted = {};
  for (const [key, entry] of Object.entries(chromeEnglish)) {
    const message = chromeUpdates.get(key) ?? chromeExisting[key]?.message;
    if (!hasText(message)) missing.push(`${CHROME_NAMESPACE}.${key}`);
    const description = chromeExisting[key]?.description ?? entry.description;
    chromeWanted[key] = { message, ...(description ? { description } : {}) };
  }
  if (missing.length) {
    problems.push(
      ...listed(missing).map((key) =>
        key.startsWith('...')
          ? key
          : `${key}: missing translation ("current" is null)`
      )
    );
  }
  if (problems.length) {
    throw new I18nToolError(
      `Refusing to import ${lang}; nothing was written:`,
      problems
    );
  }

  const written = [];
  const write = async (file, source) => {
    if (dryRun) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== source)
        written.push(rel(root, file));
      return;
    }
    if (await writeFormatted(file, source)) written.push(rel(root, file));
  };

  const dir = localeDir(root, lang);
  for (const { ns, wanted } of plans) {
    const file = join(dir, `${ns}.ts`);
    const parsed = existing.files[ns];
    if (parsed) {
      const patched = patchNamespaceSource(parsed, wanted);
      if (patched !== parsed.source) await write(file, patched);
    } else {
      const header = english.files[ns]?.header ?? '';
      await write(file, renderNamespaceFile(lang, ns, wanted, { header }));
    }
  }

  const namespaces = namespaceFiles(root, SOURCE_LANGUAGE);
  const indexFile = join(dir, 'index.ts');
  const index = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
  if (!namespaces.every((ns) => index.includes(`from './${ns}'`))) {
    await write(indexFile, renderIndexFile(lang, namespaces));
  }

  if (!sameChromeMessages(chromeWanted, chromeExisting)) {
    await write(
      chromeMessagesFile(root, info.chromeLocale),
      `${JSON.stringify(chromeWanted, null, 2)}\n`
    );
  }

  return { written, warnings, translated };
}

async function main(argv) {
  const { positional, options } = parseArgs(argv);
  const [lang, input] = positional;
  if (!lang || !input) {
    throw new I18nToolError(
      'Usage: pnpm i18n:import <lang> <file> [--dry-run]'
    );
  }
  const file = resolve(process.cwd(), input);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new I18nToolError(`Cannot read ${input}: ${error.message}`);
  }
  const dryRun = Boolean(options['dry-run']);
  const { written, warnings } = await importTranslation(REPO_ROOT, lang, data, {
    dryRun,
  });
  for (const warning of warnings) console.warn(`[i18n] warning: ${warning}`);
  if (written.length === 0)
    console.log(`[i18n] ${lang}: already up to date, nothing written`);
  else {
    console.log(
      `[i18n] ${lang}: ${dryRun ? 'would write' : 'wrote'} ${written.length} file(s)`
    );
    for (const path of written) console.log(`  ${path}`);
  }
  const { enabled } = readLanguages(REPO_ROOT);
  if (!enabled.includes(lang)) {
    console.log(
      `[i18n] ${lang} is a draft: run pnpm i18n:check, then move it into APP_LANGUAGES and LANGUAGE_INFO (docs/v2/I18N.md).`
    );
  }
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
