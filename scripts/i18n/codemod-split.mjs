#!/usr/bin/env node
/**
 * One-shot codemod (ACORN-9): splits src/i18n/messages/<ns>.ts, which held
 * every language in one `defineMessages({ en, ko, ... })` call, into
 * src/i18n/locales/<lang>/<ns>.ts plus src/i18n/locales/<lang>/index.ts.
 *
 * Usage: node scripts/i18n/codemod-split.mjs [--delete-source]
 * Refuses to overwrite an existing locales folder.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  I18nToolError,
  isMain,
  REPO_ROOT,
  SOURCE_LANGUAGE,
  parseArgs,
  parseLiteral,
  paths,
  readLanguages,
  rel,
  renderIndexFile,
  renderNamespaceFile,
  runCli,
  writeFormatted,
} from './lib.mjs';

function readCombinedFile(root, file) {
  const source = readFileSync(file, 'utf8');
  // `defineMessages(` or `defineMessages<Record<ColorTheme, string>>(`.
  const call = /defineMessages(?:<(.+)>)?\(/.exec(source);
  if (!call) throw new I18nToolError(`${rel(root, file)}: no defineMessages(`);
  const englishType = call[1];
  // Imports the English key type needs (not the old defineMessages helper).
  const imports = source
    .split('\n')
    .filter((line) => line.startsWith('import ') && !line.includes("'../define'"));
  const node = parseLiteral(source, call.index + call[0].length, rel(root, file));
  if (node.type !== 'object') throw new I18nToolError(`${rel(root, file)}: not an object`);
  const header = /(\/\*\*[\s\S]*?\*\/)\s*export default/.exec(source)?.[1] ?? '';
  const languages = new Map();
  for (const { key: lang, value } of node.entries) {
    if (value.type !== 'object') throw new I18nToolError(`${rel(root, file)}: ${lang} is not an object`);
    languages.set(
      lang,
      value.entries.map((entry) => {
        if (entry.value.type !== 'string') {
          throw new I18nToolError(`${rel(root, file)}: ${lang}.${entry.key} is not a string`);
        }
        return [entry.key, entry.value.value];
      })
    );
  }
  return { header, languages, imports, englishType };
}

export async function splitMessages(root = REPO_ROOT, { deleteSource = false } = {}) {
  const { i18n, locales } = paths(root);
  const messagesDir = join(i18n, 'messages');
  if (existsSync(locales)) throw new I18nToolError(`${rel(root, locales)} already exists`);
  const { enabled } = readLanguages(root);
  const namespaces = readdirSync(messagesDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.slice(0, -3))
    .sort();

  const written = [];
  for (const ns of namespaces) {
    const { header, languages, imports, englishType } = readCombinedFile(
      root,
      join(messagesDir, `${ns}.ts`)
    );
    const unknown = [...languages.keys()].filter((lang) => !enabled.includes(lang));
    if (unknown.length) {
      throw new I18nToolError(`${ns}: languages outside APP_LANGUAGES: ${unknown.join(', ')}`);
    }
    for (const lang of enabled) {
      const entries = languages.get(lang);
      if (!entries) throw new I18nToolError(`${ns}: no ${lang} messages`);
      const file = join(locales, lang, `${ns}.ts`);
      await writeFormatted(
        file,
        renderNamespaceFile(lang, ns, entries, { header, imports, englishType })
      );
      written.push(file);
    }
  }
  for (const lang of enabled) {
    const file = join(locales, lang, 'index.ts');
    await writeFormatted(file, renderIndexFile(lang, namespaces));
    written.push(file);
  }
  if (deleteSource) rmSync(messagesDir, { recursive: true });
  return { namespaces, languages: enabled, written };
}

async function main(argv) {
  const { options } = parseArgs(argv);
  const result = await splitMessages(REPO_ROOT, { deleteSource: Boolean(options['delete-source']) });
  console.log(
    `[i18n] split ${result.namespaces.length} namespaces x ${result.languages.length} languages ` +
      `(${result.written.length} files) into ${rel(REPO_ROOT, paths().locales)}` +
      (options['delete-source'] ? '; removed src/i18n/messages' : '')
  );
  if (!result.languages.includes(SOURCE_LANGUAGE)) throw new I18nToolError('no English locale');
  return 0;
}

if (isMain(import.meta.url)) runCli(main);
