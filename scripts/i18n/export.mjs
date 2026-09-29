#!/usr/bin/env node
/**
 * pnpm i18n:export <lang> [--out file]
 *
 * Writes a translation file for one language: every message key (app
 * namespaces and Chrome's public/_locales) with the English text, the
 * current translation (null when missing) and the placeholders to keep.
 * Hand it to a translator (a person or an LLM), then run i18n:import.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHROME_NAMESPACE,
  I18nToolError,
  REPO_ROOT,
  SOURCE_LANGUAGE,
  isMain,
  languageInfo,
  namespaceFiles,
  parseArgs,
  placeholders,
  readChromeMessages,
  readLanguages,
  readLocale,
  requiredKeys,
  runCli,
  sourceText,
  splitPluralKey,
} from './lib.mjs';

function unique(values) {
  return [...new Set(values)];
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * @returns {{ lang: string, source: 'en', instructions: string,
 *   keys: Record<string, { en: string, current: string | null, placeholders: string[], description?: string, note?: string }> }}
 */
export function buildExport(root, lang) {
  const languages = readLanguages(root);
  const info = languageInfo(languages, lang);
  const english = readLocale(root, SOURCE_LANGUAGE);
  const target = lang === SOURCE_LANGUAGE ? english : readLocale(root, lang);

  const keys = {};
  for (const ns of namespaceFiles(root, SOURCE_LANGUAGE)) {
    const en = english.namespaces[ns];
    const current = target.namespaces[ns] ?? {};
    for (const key of requiredKeys(en, info.intlLocale)) {
      const text = sourceText(en, key);
      const entry = {
        en: text,
        current: nonEmpty(current[key]),
        placeholders: unique(placeholders(text)),
      };
      if (!(key in en)) {
        const { base, category } = splitPluralKey(key);
        entry.note =
          `Plural form "${category}" (${info.englishName} uses it; English does not). ` +
          `The English text is ${base}_other.`;
      }
      keys[`${ns}.${key}`] = entry;
    }
  }

  const chromeEnglish = readChromeMessages(
    root,
    languages.info[SOURCE_LANGUAGE].chromeLocale
  );
  if (!chromeEnglish)
    throw new I18nToolError('public/_locales/en/messages.json is missing');
  const chromeTarget = readChromeMessages(root, info.chromeLocale) ?? {};
  for (const [key, { message, description }] of Object.entries(chromeEnglish)) {
    keys[`${CHROME_NAMESPACE}.${key}`] = {
      en: message,
      current: nonEmpty(chromeTarget[key]?.message),
      placeholders: unique(placeholders(message, CHROME_NAMESPACE)),
      ...(description ? { description } : {}),
    };
  }

  return {
    lang,
    source: SOURCE_LANGUAGE,
    instructions:
      `Translate each "en" text into ${info.englishName} (${info.nativeName}) and put it in ` +
      '"current"; leave "current" as it is when it is already right. Keep every ' +
      'placeholder listed in "placeholders" exactly ({name} in app strings, $NAME$ in ' +
      '_locales strings). Keys ending in _one/_other (and _zero/_two/_few/_many) are ' +
      'plural forms of one message: write the form for that count. Keep product and ' +
      'brand names (OpenAI, OpenRouter, Claude Code, Codex, ...) unchanged. Keys ' +
      'starting with _locales. are Chrome menu and store strings.',
    keys,
  };
}

async function main(argv) {
  const { positional, options } = parseArgs(argv);
  const [lang] = positional;
  if (!lang)
    throw new I18nToolError('Usage: pnpm i18n:export <lang> [--out file]');
  const data = buildExport(REPO_ROOT, lang);
  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (typeof options.out === 'string') {
    const file = resolve(process.cwd(), options.out);
    writeFileSync(file, json);
    const total = Object.keys(data.keys).length;
    const missing = Object.values(data.keys).filter(
      (entry) => entry.current === null
    ).length;
    console.error(
      `[i18n] ${lang}: ${total} keys, ${missing} untranslated -> ${file}`
    );
  } else {
    process.stdout.write(json);
  }
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
