#!/usr/bin/env node
/**
 * pnpm i18n:new <lang> [--native <name>] [--english <name>] [--intl <tag>]
 *                      [--chrome <locale>] [--currency <ISO 4217>]
 *                      [--day-picker <id>]
 *
 * Starts a language as a draft:
 * - adds a registry stub to DRAFT_LANGUAGE_INFO in src/i18n/languages.ts
 *   (derived from Intl where possible; review it),
 * - creates src/i18n/locales/<lang>/translation.json, the i18n:export file
 *   with every string untranslated.
 * The language stays out of APP_LANGUAGES, so it is not offered, detected
 * or bundled into the picker until it is complete. Chrome's
 * public/_locales/<chromeLocale>/ folder is created by i18n:import, not
 * here: every folder there ships and must hold a complete messages.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildExport } from './export.mjs';
import {
  I18nToolError,
  REPO_ROOT,
  isMain,
  localeDir,
  parseArgs,
  paths,
  quote,
  readExportedConst,
  readLanguages,
  rel,
  runCli,
  writeFormatted,
} from './lib.mjs';

/**
 * Locales the Chrome Web Store and chrome.i18n accept as _locales folder
 * names (developer.chrome.com/docs/extensions/reference/api/i18n#locales).
 */
export const CHROME_LOCALES = new Set(
  (
    'ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu ' +
    'id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi ' +
    'zh_CN zh_TW'
  ).split(' ')
);

/** language[-Script][-REGION], e.g. fr, pt-BR, sr-Latn, es-419. */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-(?:[A-Z]{2}|\d{3}))?$/;

function displayName(inLocale, code) {
  try {
    return (
      new Intl.DisplayNames([inLocale], { type: 'language' }).of(code) ?? ''
    );
  } catch {
    return '';
  }
}

function capitalize(text, locale) {
  return text ? text[0].toLocaleUpperCase(locale) + text.slice(1) : text;
}

function guessChromeLocale(lang) {
  const underscored = lang.replace(/-/g, '_');
  if (CHROME_LOCALES.has(underscored)) return underscored;
  const base = lang.split('-')[0];
  return CHROME_LOCALES.has(base) ? base : null;
}

function dayPickerLocaleExists(id) {
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(id)) return false;
  try {
    import.meta.resolve(`react-day-picker/locale/${id}`);
    return true;
  } catch {
    // Runners without import.meta.resolve: look at the package files.
    return existsSync(
      join(
        REPO_ROOT,
        'node_modules/react-day-picker/dist/esm/locale',
        `${id}.js`
      )
    );
  }
}

/** Derives the registry stub; explicit options win. */
export function draftInfo(lang, options = {}) {
  const warnings = [];
  const intlLocale = options.intl ?? lang;
  if (Intl.PluralRules.supportedLocalesOf(intlLocale).length === 0) {
    throw new I18nToolError(
      `"${intlLocale}" is not a locale this JavaScript runtime knows (Intl).`
    );
  }
  const nativeName =
    options.native ?? capitalize(displayName(lang, lang), lang);
  const englishName = options.english ?? displayName('en', lang);
  if (!nativeName || !englishName || nativeName === lang) {
    throw new I18nToolError(
      `Cannot name "${lang}"; pass --native and --english.`
    );
  }

  const chromeLocale = options.chrome ?? guessChromeLocale(lang);
  if (!chromeLocale) {
    throw new I18nToolError(
      `Chrome has no _locales code for "${lang}"; pass --chrome (one of: ${[...CHROME_LOCALES].join(' ')}).`
    );
  }
  if (!CHROME_LOCALES.has(chromeLocale)) {
    warnings.push(
      `"${chromeLocale}" is not in Chrome's documented locale list; Chrome may ignore it.`
    );
  }

  const currency = options.currency ?? 'XXX';
  if (!/^[A-Z]{3}$/.test(currency))
    throw new I18nToolError(`--currency must be an ISO 4217 code like EUR.`);
  if (currency === 'XXX') {
    warnings.push(
      'defaultCurrency is XXX (no currency): set it before enabling (--currency EUR).'
    );
  }

  let dayPickerLocale = options['day-picker'];
  if (!dayPickerLocale) {
    dayPickerLocale = [lang, lang.split('-')[0]].find(dayPickerLocaleExists);
    if (!dayPickerLocale) {
      dayPickerLocale = 'en-US';
      warnings.push(
        `react-day-picker has no "${lang}" locale; the calendar would stay in English.`
      );
    }
  }

  return {
    info: {
      code: lang,
      nativeName,
      englishName,
      intlLocale,
      chromeLocale,
      defaultCurrency: currency,
      dayPickerLocale,
    },
    warnings,
  };
}

function renderStub(info) {
  const fields = Object.entries(info)
    .map(([key, value]) => `    ${key}: ${quote(value)},`)
    .join('\n');
  return `  ${quote(info.code)}: {\n${fields}\n  },`;
}

/** Inserts the draft entry at the end of DRAFT_LANGUAGE_INFO in languages.ts. */
export function insertDraftEntry(source, info, file = 'languages.ts') {
  const node = readExportedConst(source, 'DRAFT_LANGUAGE_INFO', file);
  if (node.type !== 'object')
    throw new I18nToolError(`${file}: DRAFT_LANGUAGE_INFO is not an object`);
  const last = node.entries.at(-1);
  const at = last ? last.end : node.start + 1;
  const comma = last && source[last.end - 1] !== ',' ? ',' : '';
  return `${source.slice(0, at)}${comma}\n${renderStub(info)}${source.slice(at)}`;
}

export async function scaffoldLanguage(root, lang, options = {}) {
  if (!LANGUAGE_CODE.test(lang)) {
    throw new I18nToolError(
      `"${lang}" is not a language code like fr, pt-BR or sr-Latn.`
    );
  }
  const languages = readLanguages(root);
  if (languages.enabled.includes(lang))
    throw new I18nToolError(`${lang} is already an app language.`);
  if (languages.drafts[lang])
    throw new I18nToolError(`${lang} is already a draft.`);
  const dir = localeDir(root, lang);
  if (existsSync(dir))
    throw new I18nToolError(`${rel(root, dir)} already exists.`);

  const { info, warnings } = draftInfo(lang, options);
  const taken = Object.values({ ...languages.info, ...languages.drafts }).find(
    (other) => other.chromeLocale === info.chromeLocale
  );
  if (taken) {
    throw new I18nToolError(
      `${taken.code} already uses the Chrome locale ${info.chromeLocale}; pass --chrome.`
    );
  }

  const languagesFile = paths(root).languagesFile;
  const source = readFileSync(languagesFile, 'utf8');
  await writeFormatted(
    languagesFile,
    insertDraftEntry(source, info, rel(root, languagesFile))
  );

  const translationFile = join(dir, 'translation.json');
  await writeFormatted(
    translationFile,
    `${JSON.stringify(buildExport(root, lang), null, 2)}\n`
  );

  return {
    info,
    warnings,
    files: [rel(root, languagesFile), rel(root, translationFile)],
  };
}

async function main(argv) {
  const { positional, options } = parseArgs(argv);
  const [lang] = positional;
  if (!lang)
    throw new I18nToolError(
      'Usage: pnpm i18n:new <lang> [--currency EUR] [--chrome fr] ...'
    );
  const { info, warnings, files } = await scaffoldLanguage(
    REPO_ROOT,
    lang,
    options
  );
  console.log(
    `[i18n] ${lang}: draft created (${info.nativeName} / ${info.englishName})`
  );
  for (const file of files) console.log(`  ${file}`);
  for (const warning of warnings) console.warn(`[i18n] warning: ${warning}`);
  console.log(`Next:
  1. Review the ${lang} entry in DRAFT_LANGUAGE_INFO (src/i18n/languages.ts).
  2. Translate src/i18n/locales/${lang}/translation.json (fill every "current").
  3. pnpm i18n:import ${lang} src/i18n/locales/${lang}/translation.json
  4. Move the entry to LANGUAGE_INFO, add '${lang}' to APP_LANGUAGES, delete
     translation.json, then pnpm i18n:check && pnpm typecheck && pnpm test.`);
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
